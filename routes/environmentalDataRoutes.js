// routes/environmentalDataRoutes.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { 
  refreshEnvironmentalData, 
  getLatestEnvironmentalData,
  getEnvironmentalDataRange,
  getCRIHistory,
  updateUserLocation
} = require("../controllers/environmentalDataController");

// Middleware to verify JWT token
const { authenticateToken, verifyEmail } = require("../middleware/auth");

// Get latest environmental data with percentage changes
// Public route - no authentication required
router.get(
  "/latest",
  (req, res, next) => {
    // Try to authenticate but don't require it
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (token) {
      jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (!err) {
          req.user = user;
        }
        next();
      });
    } else {
      next();
    }
  },
  getLatestEnvironmentalData
);

// Get environmental data within a date range
// Requires authentication
router.get("/range", authenticateToken, verifyEmail, getEnvironmentalDataRange);

// Get CRI history and trends
router.get("/cri-history", authenticateToken, verifyEmail, getCRIHistory);

// Update user location
router.post("/update-location", authenticateToken, verifyEmail, updateUserLocation);

// Manual trigger to refresh environmental data
// Requires authentication and should be limited to admin users in production
router.post("/refresh", authenticateToken, verifyEmail, refreshEnvironmentalData);

module.exports = router;