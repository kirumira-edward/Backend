const Notification = require("../models/Notification");
// Import using try-catch to prevent OverwriteModelError
const mongoose = require("mongoose");
let Farmer;
try {
  Farmer = mongoose.model("Farmer");
} catch (error) {
  Farmer = require("../models/Farmer");
}
const {
  sendNotification,
  markNotificationAsRead,
  getFarmerNotifications,
  registerDeviceToken
} = require("../utils/notificationService");
const { sendFarmingTip } = require("../utils/notificationTriggers");

/**
 * Get VAPID public key for push notifications
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getVapidKey = (req, res) => {
  try {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;

    if (!vapidPublicKey) {
      console.error("VAPID_PUBLIC_KEY not set in environment variables");
      return res.status(500).json({
        message: "Push notification service is not properly configured"
      });
    }

    res.status(200).json({ vapidPublicKey });
  } catch (error) {
    console.error("Error retrieving VAPID key:", error);
    res.status(500).json({
      message: "Failed to retrieve VAPID key",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

/**
 * Get notifications for authenticated farmer
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserNotifications = async (req, res) => {
  try {
    const { read, type, limit = 20, skip = 0 } = req.query;

    const filters = {};
    if (read !== undefined) {
      filters.read = read === "true";
    }
    if (type) {
      filters.type = type;
    }

    const notifications = await getFarmerNotifications(
      req.user.id,
      filters,
      parseInt(limit),
      parseInt(skip)
    );

    // Get unread count
    const unreadCount = await Notification.countDocuments({
      farmerId: req.user.id,
      read: false,
      expiresAt: { $gt: new Date() }
    });

    res.status(200).json({
      notifications,
      unreadCount,
      metadata: {
        total: notifications.length,
        limit: parseInt(limit),
        skip: parseInt(skip)
      }
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch notifications", error: error.message });
  }
};

/**
 * Mark notification as read
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await markNotificationAsRead(id, req.user.id);

    res.status(200).json({
      message: "Notification marked as read",
      notification
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({
      message: "Failed to mark notification as read",
      error: error.message
    });
  }
};

/**
 * Mark all notifications as read
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { farmerId: req.user.id, read: false },
      { read: true }
    );

    res.status(200).json({
      message: "All notifications marked as read"
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({
      message: "Failed to mark all notifications as read",
      error: error.message
    });
  }
};

/**
 * Register device token for push notifications
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const registerDevice = async (req, res) => {
  try {
    const { deviceToken } = req.body;

    if (!deviceToken) {
      return res.status(400).json({ message: "Device token is required" });
    }
    
    // Try to parse the device token if it's a stringified JSON
    let processedToken = deviceToken;
    try {
      // Check if it's a string representation of a JSON object
      const parsed = JSON.parse(deviceToken);
      
      // If the parsed result has 'endpoint', it's most likely a PushSubscription
      if (parsed && parsed.endpoint) {
        // Store the full stringified subscription
        processedToken = deviceToken;
      }
    } catch (e) {
      // Not a JSON string, use as-is
      processedToken = deviceToken;
    }

    await registerDeviceToken(req.user.id, processedToken);

    res.status(200).json({
      message: "Device registered successfully"
    });
  } catch (error) {
    console.error("Error registering device:", error);
    res
      .status(500)
      .json({ message: "Failed to register device", error: error.message });
  }
};

/**
 * Update notification settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateNotificationSettings = async (req, res) => {
  try {
    const {
      enablePush,
      enableEmail,
      weatherAlerts,
      blightRiskAlerts,
      farmingTips,
      diagnosisResults
    } = req.body;

    const updateData = { notificationSettings: {} };

    // Only update fields that were provided
    if (enablePush !== undefined)
      updateData.notificationSettings.enablePush = enablePush;
    if (enableEmail !== undefined)
      updateData.notificationSettings.enableEmail = enableEmail;
    if (weatherAlerts !== undefined)
      updateData.notificationSettings.weatherAlerts = weatherAlerts;
    if (blightRiskAlerts !== undefined)
      updateData.notificationSettings.blightRiskAlerts = blightRiskAlerts;
    if (farmingTips !== undefined)
      updateData.notificationSettings.farmingTips = farmingTips;
    if (diagnosisResults !== undefined)
      updateData.notificationSettings.diagnosisResults = diagnosisResults;

    const farmer = await Farmer.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true }
    );

    res.status(200).json({
      message: "Notification settings updated successfully",
      settings: farmer.notificationSettings
    });
  } catch (error) {
    console.error("Error updating notification settings:", error);
    res.status(500).json({
      message: "Failed to update notification settings",
      error: error.message
    });
  }
};

/**
 * Manually send a farming tip notification (for testing)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const sendTip = async (req, res) => {
  try {
    await sendFarmingTip(req.user.id);

    res.status(200).json({
      message: "Farming tip sent successfully"
    });
  } catch (error) {
    console.error("Error sending farming tip:", error);
    res
      .status(500)
      .json({ message: "Failed to send farming tip", error: error.message });
  }
};

/**
 * Get user app permissions
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserPermissions = async (req, res) => {
  try {
    const farmer = await Farmer.findById(req.user.id);

    if (!farmer) {
      return res.status(404).json({ message: "Farmer not found" });
    }

    // Get stored preferences or use defaults
    const preferences = farmer.preferences || {};

    res.status(200).json({
      camera: preferences.camera || false,
      location: preferences.location || Boolean(farmer.defaultLocation),
      notifications:
        preferences.notifications ||
        Boolean(farmer.notificationSettings?.enablePush),
      dataSync:
        preferences.dataSync !== undefined ? preferences.dataSync : true,
      analytics:
        preferences.analytics !== undefined ? preferences.analytics : true,
      offline: preferences.offline || false
    });
  } catch (error) {
    console.error("Error fetching user permissions:", error);
    res.status(500).json({
      message: "Failed to fetch user permissions",
      error: error.message
    });
  }
};

module.exports = {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  registerDevice,
  updateNotificationSettings,
  sendTip,
  getVapidKey,
  getUserPermissions
};
