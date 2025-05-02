// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
// Import error handler
const { handleApiError } = require("./utils/errorHandler");
// Import models using a try-catch to prevent OverwriteModelError
let Farmer;
try {
  Farmer = mongoose.model("Farmer");
} catch (error) {
  Farmer = require("./models/Farmer");
}
const { sendVerificationEmail } = require("./utils/emailService");
const { uploadProfileImage } = require("./utils/cloudinaryService");
const { startSchedulers } = require("./utils/dataScheduler");
const environmentalDataRoutes = require("./routes/environmentalDataRoutes");
const diagnosisRoutes = require("./routes/diagnosisRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const userRoutes = require("./routes/userRoutes");
const mapRoutes = require("./routes/mapRoutes");
const authRoutes = require("./routes/authRoutes");
const { initializeFirebaseAdmin } = require("./utils/firebaseInit");
// Import analytics routes properly
const analyticsRoutes = require("./routes/analyticsRoutes");
// Import user controller functions
const {
  forgotPassword,
  verifyResetToken,
  resetPassword
} = require("./controllers/userController");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware setup
app.use(
  cors({
    origin: [
      "http://localhost:8080",
      "http://192.168.1.170:8080",
      "https://tomato-expert-frontend.onrender.com"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// MongoDB connection function
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }
};

// Authentication Middleware for JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ message: "Access denied. No token provided." });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token." });
    }
    req.user = user;
    next();
  });
}

// Verify email is verified before continuing
async function verifyEmail(req, res, next) {
  try {
    const farmer = await Farmer.findById(req.user.id);

    if (!farmer) {
      return res.status(404).json({ message: "Farmer not found." });
    }

    if (!farmer.isVerified) {
      return res.status(403).json({
        message: "Email not verified. Please verify your email first.",
        needsVerification: true,
        email: farmer.email
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: "Server error verifying email status." });
  }
}

// Generate access and refresh tokens
function generateTokens(user, rememberMe = false) {
  const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "15m"
  });

  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: rememberMe ? "30d" : "7d" }
  );

  return { accessToken, refreshToken };
}

// Refresh user tokens
async function refreshUserTokens(refreshToken) {
  const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

  const farmer = await Farmer.findOne({
    _id: decoded.id,
    refreshToken: refreshToken
  });

  if (!farmer) {
    throw new Error("Invalid refresh token.");
  }

  const tokens = generateTokens(farmer, farmer.rememberMe);

  farmer.refreshToken = tokens.refreshToken;
  await farmer.save();

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    farmer
  };
}

// ROUTES

// Register new farmer
app.post("/api/register", async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  try {
    // Check if farmer already exists
    const existingFarmer = await Farmer.findOne({ email });
    if (existingFarmer) {
      return res
        .status(400)
        .json({ message: "Farmer already registered with this email." });
    }

    // Create new farmer
    const farmer = new Farmer({
      firstName,
      lastName,
      email,
      password
    });

    // Generate verification code
    const verificationCode = farmer.generateVerificationCode();

    // Save farmer to database
    await farmer.save();

    // Send verification email
    await sendVerificationEmail(email, firstName, verificationCode);

    res.status(201).json({
      message:
        "Farmer registered successfully. Please check your email for verification code.",
      email
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error registering farmer." });
  }
});

// Verify email with code
app.post("/api/verify-email", async (req, res) => {
  const { email, code } = req.body;

  try {
    const farmer = await Farmer.findOne({
      email,
      verificationCode: code,
      verificationCodeExpires: { $gt: Date.now() }
    });

    if (!farmer) {
      return res
        .status(400)
        .json({ message: "Invalid or expired verification code." });
    }

    // Mark email as verified and clear verification code
    farmer.isVerified = true;
    farmer.verificationCode = undefined;
    farmer.verificationCodeExpires = undefined;

    await farmer.save();

    res.json({ message: "Email verified successfully. You can now log in." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error verifying email." });
  }
});

// Resend verification code
app.post("/api/resend-verification", async (req, res) => {
  const { email } = req.body;

  try {
    const farmer = await Farmer.findOne({ email });

    if (!farmer) {
      return res.status(404).json({ message: "Farmer not found." });
    }

    if (farmer.isVerified) {
      return res.status(400).json({ message: "Email is already verified." });
    }

    // Generate new verification code
    const verificationCode = farmer.generateVerificationCode();
    await farmer.save();

    // Send verification email
    await sendVerificationEmail(email, farmer.firstName, verificationCode);

    res.json({ message: "Verification code resent. Please check your email." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error resending verification code." });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  const { email, password, rememberMe = false } = req.body;

  try {
    const farmer = await Farmer.findOne({ email });
    if (!farmer) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    const isMatch = await farmer.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    // Check if email is verified
    if (!farmer.isVerified) {
      return res.status(403).json({
        message: "Email not verified. Please verify your email first.",
        needsVerification: true,
        email: farmer.email
      });
    }

    // Update the remember me preference
    farmer.rememberMe = rememberMe;

    // Update last active timestamp
    farmer.lastActive = new Date();

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(farmer, rememberMe);

    // Save refresh token to database
    farmer.refreshToken = refreshToken;
    await farmer.save();

    // Set refresh token as HTTP-only cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000, // 7 days or 30 days
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict"
    });

    res.json({
      accessToken,
      user: {
        id: farmer._id,
        firstName: farmer.firstName,
        lastName: farmer.lastName,
        email: farmer.email,
        profilePhoto: farmer.profilePhoto
      },
      message: "Login successful."
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error logging in farmer." });
  }
});

// Refresh token endpoint
app.post("/api/refresh-token", async (req, res) => {
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh token not provided." });
  }

  try {
    const {
      accessToken,
      refreshToken: newRefreshToken,
      farmer
    } = await refreshUserTokens(refreshToken);

    // Set new refresh token as HTTP-only cookie
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      maxAge: farmer.rememberMe
        ? 30 * 24 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict"
    });

    res.json({
      accessToken,
      user: {
        id: farmer._id,
        firstName: farmer.firstName,
        lastName: farmer.lastName,
        email: farmer.email,
        profilePhoto: farmer.profilePhoto,
        lastActive: farmer.lastActive
      }
    });
  } catch (err) {
    res.status(403).json({ message: "Invalid refresh token." });
  }
});

// Logout
app.post("/api/logout", authenticateToken, async (req, res) => {
  try {
    // Clear refresh token in database
    const farmer = await Farmer.findById(req.user.id);
    if (farmer) {
      farmer.refreshToken = undefined;
      await farmer.save();
    }

    // Clear refresh token cookie
    res.clearCookie("refreshToken");

    res.json({ message: "Logged out successfully." });
  } catch (err) {
    res.status(500).json({ message: "Error logging out." });
  }
});

// Get user profile
app.get("/api/user", authenticateToken, verifyEmail, async (req, res) => {
  try {
    const farmer = await Farmer.findById(req.user.id).select(
      "-password -refreshToken -verificationCode -verificationCodeExpires"
    );
    if (!farmer) {
      return res.status(404).json({ message: "Farmer not found." });
    }

    res.json(farmer);
  } catch (err) {
    res.status(500).json({ message: "Error fetching user data." });
  }
});

// Upload profile photo to Cloudinary
app.put("/api/user/photo", authenticateToken, verifyEmail, async (req, res) => {
  try {
    // Check if request contains image data
    if (!req.body.image) {
      return res.status(400).json({ message: "No image data provided." });
    }

    const farmer = await Farmer.findById(req.user.id);
    if (!farmer) {
      return res.status(404).json({ message: "Farmer not found." });
    }

    // Upload to Cloudinary
    const uploadResult = await uploadProfileImage(req.body.image, farmer._id);

    // Update farmer's profile photo with Cloudinary URL
    farmer.profilePhoto = uploadResult.url;
    await farmer.save();

    res.json({
      message: "Profile photo updated successfully.",
      profilePhoto: uploadResult.url
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating profile photo." });
  }
});

// Get user permissions
app.get(
  "/api/user/permissions",
  authenticateToken,
  verifyEmail,
  async (req, res) => {
    try {
      const {
        getUserPermissions
      } = require("./controllers/notificationController");
      await getUserPermissions(req, res);
    } catch (err) {
      handleApiError(err, res, "Error fetching user permissions");
    }
  }
);

// Update user permissions
app.put(
  "/api/user/permissions",
  authenticateToken,
  verifyEmail,
  async (req, res) => {
    try {
      const farmer = await Farmer.findById(req.user.id);
      if (!farmer) {
        return res.status(404).json({ message: "Farmer not found" });
      }

      // Update permissions (store them as part of user preferences)
      if (!farmer.preferences) {
        farmer.preferences = {};
      }

      // Only update fields that were provided
      if (req.body.camera !== undefined)
        farmer.preferences.camera = req.body.camera;
      if (req.body.location !== undefined)
        farmer.preferences.location = req.body.location;
      if (req.body.notifications !== undefined)
        farmer.preferences.notifications = req.body.notifications;
      if (req.body.dataSync !== undefined)
        farmer.preferences.dataSync = req.body.dataSync;
      if (req.body.analytics !== undefined)
        farmer.preferences.analytics = req.body.analytics;
      if (req.body.offline !== undefined)
        farmer.preferences.offline = req.body.offline;

      await farmer.save();

      res.status(200).json({
        message: "User permissions updated successfully",
        permissions: farmer.preferences
      });
    } catch (err) {
      handleApiError(err, res, "Error updating user permissions");
    }
  }
);

// Get notification settings
app.get(
  "/api/user/notification-settings",
  authenticateToken,
  verifyEmail,
  async (req, res) => {
    try {
      const farmer = await Farmer.findById(req.user.id);
      if (!farmer) {
        return res.status(404).json({ message: "Farmer not found" });
      }

      res.json(
        farmer.notificationSettings || {
          enablePush: true,
          enableEmail: true,
          weatherAlerts: true,
          blightRiskAlerts: true,
          farmingTips: true,
          diagnosisResults: true
        }
      );
    } catch (err) {
      handleApiError(err, res, "Error fetching notification settings");
    }
  }
);

// Forgot password - request reset
app.post("/api/forgot-password", async (req, res) => {
  try {
    await forgotPassword(req, res);
  } catch (err) {
    handleApiError(err, res, "Error processing forgot password request");
  }
});

// Verify reset token
app.post("/api/verify-reset-token", async (req, res) => {
  try {
    await verifyResetToken(req, res);
  } catch (err) {
    handleApiError(err, res, "Error verifying reset token");
  }
});

// Reset password with token
app.post("/api/reset-password", async (req, res) => {
  try {
    await resetPassword(req, res);
  } catch (err) {
    handleApiError(err, res, "Error resetting password");
  }
});

// Delete account route
app.post(
  "/api/user/delete-account",
  authenticateToken,
  verifyEmail,
  async (req, res) => {
    try {
      const { deleteAccount } = require("./controllers/userController");
      await deleteAccount(req, res);
    } catch (err) {
      handleApiError(err, res, "Error deleting account");
    }
  }
);

// ENVIRONMENTAL DATA ROUTES
app.use("/api/environmental", environmentalDataRoutes);

// Diagnosis Routes
app.use("/api/diagnosis", diagnosisRoutes);

// Notification Routes
app.use("/api/notifications", notificationRoutes);

// User Account Routes
app.use("/api/user", userRoutes);

// Map Routes - ensure this is registered
app.use("/api/map", mapRoutes);

// Auth Routes
app.use("/api/auth", authRoutes);

// Analytics Routes
app.use("/api/analytics", analyticsRoutes);

// Development endpoint to get verification code (only in development)
if (process.env.NODE_ENV === "development") {
  app.get("/api/dev/verification-code/:email", async (req, res) => {
    try {
      const farmer = await Farmer.findOne({ email: req.params.email });
      if (!farmer) {
        return res.status(404).json({ message: "Farmer not found" });
      }
      res.json({
        verificationCode: farmer.verificationCode,
        expires: farmer.verificationCodeExpires
      });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  });
}

// Start the server only if this file is run directly
if (require.main === module) {
  connectDB().then(() => {
    // Initialize Firebase Admin SDK
    initializeFirebaseAdmin();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);

      // Start the data collection schedulers
      // Weather data every 3 hours, soil moisture every 30 minutes
      startSchedulers(
        3 * 60 * 60 * 1000, // 3 hours in milliseconds
        30 * 60 * 1000 // 30 minutes in milliseconds
      );
    });
  });
}

module.exports = { app, connectDB };
