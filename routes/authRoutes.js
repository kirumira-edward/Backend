const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const authController = require("../controllers/authController");

// Login route
router.post("/login", authController.login);

// Refresh token route
router.post("/refresh-token", authController.refreshToken);

// Logout route
router.post("/logout", authenticateToken, authController.logout);

module.exports = router;
