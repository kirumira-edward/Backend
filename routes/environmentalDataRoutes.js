// routes/environmentalDataRoutes.js
const express = require("express");
const router = express.Router();
const { 
  refreshEnvironmentalData, 
  getLatestEnvironmentalData,
  getEnvironmentalDataRange
} = require("../controllers/environmentalDataController");

// Middleware to verify JWT token
const { authenticateToken, verifyEmail } = require("../middleware/auth");

// Get latest environmental data
// Public route - no authentication required
router.get("/latest", getLatestEnvironmentalData);

// Get environmental data within a date range
// Requires authentication
router.get("/range", authenticateToken, verifyEmail, getEnvironmentalDataRange);

// Manual trigger to refresh environmental data
// Requires authentication and should be limited to admin users in production
router.post("/refresh", authenticateToken, verifyEmail, refreshEnvironmentalData);

module.exports = router;