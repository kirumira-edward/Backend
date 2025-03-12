// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Farmer = require("./models/Farmer"); // Assumes you have a Farmer model defined in models/Farmer.js

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware setup
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads")); // Serve uploaded files

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5000000 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only image files are allowed!"));
  }
});

// MongoDB connection function
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
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
    return res.status(401).json({ message: "Access denied." });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid token." });
    }
    req.user = user;
    next();
  });
}

// Routes
app.post("/api/register", async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  try {
    const existingFarmer = await Farmer.findOne({ email });
    if (existingFarmer) {
      return res.status(400).json({ message: "Farmer already registered with this email." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const farmer = new Farmer({
      firstName,
      lastName,
      email,
      password: hashedPassword
    });

    await farmer.save();
    res.status(201).json({ message: "Farmer registered successfully." });
  } catch (err) {
    res.status(500).json({ message: "Error registering farmer." });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const farmer = await Farmer.findOne({ email });
    if (!farmer) {
      return res.status(400).json({ message: "Farmer not found." });
    }

    const isMatch = await bcrypt.compare(password, farmer.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    const token = jwt.sign({ id: farmer._id }, process.env.JWT_SECRET, {
      expiresIn: "1h"
    });

    res.json({ token, message: "Login successful." });
  } catch (err) {
    res.status(500).json({ message: "Error logging in farmer." });
  }
});

app.get("/api/user", authenticateToken, async (req, res) => {
  try {
    const farmer = await Farmer.findById(req.user.id).select("-password");
    res.json(farmer);
  } catch (err) {
    res.status(500).json({ message: "Error fetching user data." });
  }
});

app.put("/api/user/photo", authenticateToken, upload.single("profilePhoto"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    const farmer = await Farmer.findById(req.user.id);
    if (!farmer) {
      return res.status(404).json({ message: "Farmer not found." });
    }

    if (farmer.profilePhoto !== "default-profile.jpg") {
      const oldPhotoPath = path.join(__dirname, "uploads", farmer.profilePhoto);
      if (fs.existsSync(oldPhotoPath)) {
        fs.unlinkSync(oldPhotoPath);
      }
    }

    farmer.profilePhoto = req.file.filename;
    await farmer.save();

    res.json({ message: "Profile photo updated successfully.", profilePhoto: req.file.filename });
  } catch (err) {
    res.status(500).json({ message: "Error updating profile photo." });
  }
});

// Start the server only if this file is run directly
if (require.main === module) {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  });
}

module.exports = { app, connectDB };
