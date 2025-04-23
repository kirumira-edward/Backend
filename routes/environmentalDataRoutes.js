// routes/environmentalDataRoutes.js
const express = require("express");
const router = express.Router();
const { authenticateToken, verifyEmail } = require("../middleware/auth");
const {
  refreshEnvironmentalData,
  getLatestEnvironmentalData,
  getEnvironmentalDataRange,
  getCRIHistory,
  updateUserLocation,
  getWeatherForecast
} = require("../controllers/environmentalDataController");

// Route to refresh environmental data
router.post(
  "/refresh",
  authenticateToken,
  verifyEmail,
  refreshEnvironmentalData
);

// Route to get latest environmental data - modify this to work even without authentication
router.get("/latest", getLatestEnvironmentalData);

// For authenticated routes, keep the middleware
router.get("/range", authenticateToken, verifyEmail, getEnvironmentalDataRange);

router.get("/cri-history", authenticateToken, verifyEmail, getCRIHistory);

// Fix the location update route - this is the key change
router.post("/location", authenticateToken, verifyEmail, updateUserLocation);

// Add the weather forecast route
router.get("/forecast", authenticateToken, verifyEmail, getWeatherForecast);

module.exports = router;
