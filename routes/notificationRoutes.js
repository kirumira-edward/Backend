// routes/notificationRoutes.js
const express = require("express");
const router = express.Router();
const {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  registerDevice,
  updateNotificationSettings,
  sendTip,
  getVapidKey
} = require("../controllers/notificationController");
const { authenticateToken, verifyEmail } = require("../middleware/auth");
const mongoose = require("mongoose");
let Farmer;
try {
  Farmer = mongoose.model("Farmer");
} catch (error) {
  Farmer = require("../models/Farmer");
}

// Get VAPID public key (no authentication required)
router.get("/vapid-key", getVapidKey);

// Apply authentication middleware to all routes below this point
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

// Route to unregister a device from push notifications
router.delete("/unregister-device", async (req, res) => {
  try {
    const { deviceToken } = req.body;

    if (!deviceToken) {
      return res.status(400).json({ message: "Device token is required" });
    }

    // Parse the device token if it's a string (it might be a stringified JSON object)
    let parsedToken;
    try {
      parsedToken = JSON.parse(deviceToken);
    } catch (e) {
      // If it can't be parsed, use it as is
      parsedToken = deviceToken;
    }

    // Try to extract the endpoint to use as a backup identifier
    let endpoint;
    if (typeof parsedToken === "object" && parsedToken.endpoint) {
      endpoint = parsedToken.endpoint;
    }

    // Update the farmer's device tokens list - remove by either exact match or endpoint
    await Farmer.findByIdAndUpdate(req.user.id, {
      $pull: {
        deviceTokens: {
          $in: [deviceToken, endpoint]
        }
      }
    });

    res.status(200).json({ message: "Device unregistered successfully" });
  } catch (error) {
    console.error("Error in unregister-device route:", error);
    res.status(500).json({
      message: "Server error unregistering device",
      error: error.message
    });
  }
});

module.exports = router;
