// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const {
  changePassword,
  deleteAccount,
  updateProfile
} = require("../controllers/userController");
const { authenticateToken, verifyEmail } = require("../middleware/auth");
const {
  updateUserLocation
} = require("../controllers/environmentalDataController"); // Import the location update controller function

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(verifyEmail);

// Change password
router.put("/change-password", changePassword);

// Delete account
router.delete("/delete-account", deleteAccount);

// Update profile (in case you want to add this functionality)
router.put("/update", updateProfile);

// Add a route to update user's farm location (as a fallback)
router.post("/location", authenticateToken, verifyEmail, updateUserLocation);

module.exports = router;
