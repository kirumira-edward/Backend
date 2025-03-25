// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const Farmer = require("./models/Farmer");
const { sendVerificationEmail } = require("./utils/emailService");
const { uploadProfileImage } = require("./utils/cloudinaryService");
const { startSchedulers } = require("./utils/dataScheduler");
const environmentalDataController = require("./controllers/environmentalDataController");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware setup
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:8080",
    credentials: true
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
function generateTokens(user) {
  const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "15m"
  });

  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken };
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
  const { email, password } = req.body;

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

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(farmer);

    // Save refresh token to database
    farmer.refreshToken = refreshToken;
    await farmer.save();

    // Set refresh token as HTTP-only cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
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
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    // Get farmer from database
    const farmer = await Farmer.findOne({
      _id: decoded.id,
      refreshToken: refreshToken
    });

    if (!farmer) {
      return res.status(403).json({ message: "Invalid refresh token." });
    }

    // Generate new tokens
    const tokens = generateTokens(farmer);

    // Update refresh token in database
    farmer.refreshToken = tokens.refreshToken;
    await farmer.save();

    // Set new refresh token as HTTP-only cookie
    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict"
    });

    res.json({ accessToken: tokens.accessToken });
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

// ENVIRONMENTAL DATA ROUTES

// In server.js - replace the direct endpoint definitions with:
const environmentalDataRoutes = require("./routes/environmentalDataRoutes");
app.use("/api/environmental", environmentalDataRoutes);

// Get latest environmental data
app.get("/api/environmental/latest", environmentalDataController.getLatestEnvironmentalData);

// Get environmental data within a date range (requires authentication)
app.get("/api/environmental/range", authenticateToken, verifyEmail, environmentalDataController.getEnvironmentalDataRange);

// Manual trigger to refresh environmental data (requires authentication)
app.post("/api/environmental/refresh", authenticateToken, verifyEmail, environmentalDataController.refreshEnvironmentalData);

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
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      
      // Start the data collection schedulers
      // Weather data every 3 hours, soil moisture every 30 minutes
      startSchedulers(
        3 * 60 * 60 * 1000,  // 3 hours in milliseconds
        30 * 60 * 1000       // 30 minutes in milliseconds
      );
    });
  });
}

module.exports = { app, connectDB };
