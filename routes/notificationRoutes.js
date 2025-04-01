// routes/notificationRoutes.js
const express = require("express");
const router = express.Router();
const {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  registerDevice,
  updateNotificationSettings,
  sendTip
} = require("../controllers/notificationController");
const { authenticateToken, verifyEmail } = require("../middleware/auth");

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(verifyEmail);

// Get notifications
router.get("/", getUserNotifications);

// Mark notification as read
router.put("/:id/read", markAsRead);

// Mark all notifications as read
router.put("/read-all", markAllAsRead);

// Register device for push notifications
router.post("/register-device", registerDevice);

// Update notification settings
router.put("/settings", updateNotificationSettings);

// Send test farming tip (for testing)
router.post("/test-tip", sendTip);

module.exports = router;
