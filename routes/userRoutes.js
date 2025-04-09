// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const { 
  changePassword, 
  deleteAccount,
  updateProfile
} = require("../controllers/userController");
const { authenticateToken, verifyEmail } = require("../middleware/auth");

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(verifyEmail);

// Change password
router.put("/change-password", changePassword);

// Delete account
router.delete("/delete-account", deleteAccount);

// Update profile (in case you want to add this functionality)
router.put("/update", updateProfile);

module.exports = router;