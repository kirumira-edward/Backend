require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const Farmer = require("./models/Farmer");
const { sendVerificationEmail, sendPasswordResetEmail } = require("./utils/emailService");

const app = express();
const PORT = process.env.PORT || 5000;

// Enhanced configuration
const CODE_EXPIRATION_MINUTES = parseInt(process.env.VERIFICATION_CODE_EXPIRES_MINUTES) || 15;
const CODE_LENGTH = 6;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json());
app.use(morgan("dev"));

// Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many attempts, please try again later."
});

// Database Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
};

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (!token) return res.status(401).json({ message: "Authorization token required" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid or expired token" });
    req.user = user;
    next();
  });
};

// Helper Functions
const generateVerificationCode = () => {
  return crypto.randomInt(10 ** (CODE_LENGTH - 1), 10 ** CODE_LENGTH - 1).toString();
};

// Routes
app.post("/api/register", authLimiter, async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  try {
    // Input Validation
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (await Farmer.findOne({ email })) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // Generate and store verification code
    const verificationCode = generateVerificationCode();
    const hashedCode = await bcrypt.hash(verificationCode, 10);
    const expiresAt = Date.now() + (CODE_EXPIRATION_MINUTES * 60 * 1000);

    const newFarmer = new Farmer({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: await bcrypt.hash(password, 10),
      verificationCode: hashedCode,
      verificationCodeExpires: expiresAt,
      isVerified: false
    });

    await newFarmer.save();
    
    // Send verification email
    console.log(`[REGISTRATION] Code for ${email}: ${verificationCode}`);
    await sendVerificationEmail(email, verificationCode);

    res.status(201).json({
      message: "Registration successful - Check your email for verification code",
      expiresInMinutes: CODE_EXPIRATION_MINUTES
    });

  } catch (err) {
    console.error("[REGISTRATION ERROR]", err);
    res.status(500).json({ message: "Server error during registration" });
  }
});

app.post("/api/verify-email", authLimiter, async (req, res) => {
  const { email, code } = req.body;
  const sanitizedEmail = email?.toLowerCase().trim();
  const sanitizedCode = code?.trim();

  try {
    if (!sanitizedEmail || !sanitizedCode) {
      return res.status(400).json({ message: "Email and code are required" });
    }

    const farmer = await Farmer.findOne({
      email: sanitizedEmail,
      verificationCodeExpires: { $gt: Date.now() }
    });

    if (!farmer) {
      console.log(`[VERIFICATION] No active code found for ${sanitizedEmail}`);
      return res.status(400).json({ message: "Code expired or invalid email" });
    }

    const isCodeValid = await bcrypt.compare(sanitizedCode, farmer.verificationCode);
    if (!isCodeValid) {
      console.log(`[VERIFICATION] Invalid code attempt for ${sanitizedEmail}`);
      return res.status(400).json({ message: "Invalid verification code" });
    }

    // Update user verification status
    farmer.isVerified = true;
    farmer.verificationCode = undefined;
    farmer.verificationCodeExpires = undefined;
    await farmer.save();

    console.log(`[VERIFICATION] Success for ${sanitizedEmail}`);
    res.json({ message: "Email verified successfully" });

  } catch (err) {
    console.error("[VERIFICATION ERROR]", err);
    res.status(500).json({ message: "Server error during verification" });
  }
});

// Resend Verification Code
app.post("/api/resend-verification", authLimiter, async (req, res) => {
  const { email } = req.body;
  const sanitizedEmail = email?.toLowerCase().trim();

  try {
    if (!sanitizedEmail) {
      return res.status(400).json({ message: "Email is required" });
    }

    const farmer = await Farmer.findOne({ email: sanitizedEmail });
    if (!farmer) {
      return res.status(404).json({ message: "Email not registered" });
    }

    if (farmer.isVerified) {
      return res.status(400).json({ message: "Email already verified" });
    }

    // Generate new code
    const newCode = generateVerificationCode();
    const hashedCode = await bcrypt.hash(newCode, 10);
    const expiresAt = Date.now() + (CODE_EXPIRATION_MINUTES * 60 * 1000);

    // Update user with new code
    farmer.verificationCode = hashedCode;
    farmer.verificationCodeExpires = expiresAt;
    await farmer.save();

    console.log(`[RESEND] New code for ${sanitizedEmail}: ${newCode}`);
    await sendVerificationEmail(sanitizedEmail, newCode);

    res.json({ 
      message: "New verification code sent",
      expiresInMinutes: CODE_EXPIRATION_MINUTES
    });

  } catch (err) {
    console.error("[RESEND ERROR]", err);
    res.status(500).json({ message: "Server error resending code" });
  }
});

// ... Keep other routes (login, password reset, etc) from previous version ...
// Login
app.post("/api/login", authLimiter, async (req, res) => {
  const { email, password } = req.body;

  try {
    const farmer = await Farmer.findOne({ email });
    
    if (!farmer) return res.status(401).json({ message: "Invalid credentials" });
    if (!farmer.isVerified) return res.status(403).json({ message: "Verify email first" });
    if (!(await bcrypt.compare(password, farmer.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: farmer._id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ token, user: { id: farmer._id, email: farmer.email } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error during login" });
  }
});

// Password Reset Flow
app.post("/api/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const farmer = await Farmer.findOne({ email });
    if (farmer) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = await bcrypt.hash(resetToken, 10);

      farmer.resetPasswordToken = hashedToken;
      farmer.resetPasswordExpires = Date.now() + 3600000; // 1 hour
      await farmer.save();
      
      await sendPasswordResetEmail(email, resetToken);
    }

    res.json({ message: "If email exists, reset instructions sent" });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Server error processing request" });
  }
});

app.post("/api/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const farmer = await Farmer.findOne({
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!farmer || !(await bcrypt.compare(token, farmer.resetPasswordToken))) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    farmer.password = await bcrypt.hash(newPassword, 10);
    farmer.resetPasswordToken = undefined;
    farmer.resetPasswordExpires = undefined;
    await farmer.save();

    res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("Password reset error:", err);
    res.status(500).json({ message: "Server error resetting password" });
  }
});

// Protected Routes
app.get("/api/user", authenticateToken, async (req, res) => {
  try {
    const farmer = await Farmer.findById(req.user.id).select("-password");
    farmer ? res.json(farmer) : res.status(404).json({ message: "User not found" });
  } catch (err) {
    console.error("User fetch error:", err);
    res.status(500).json({ message: "Server error fetching user" });
  }
});


// Start Server
connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});