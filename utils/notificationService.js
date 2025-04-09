const Notification = require("../models/Notification");
const Farmer = require("../models/Farmer");
const { sendEmail } = require("./emailService");
const { admin } = require("./firebaseAdmin");
const webpush = require("web-push");
const dotenv = require("dotenv");

dotenv.config();

// Configure web-push with VAPID keys
if (
  process.env.VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY &&
  process.env.VAPID_SUBJECT
) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn(
    "VAPID keys not configured. Web Push notifications will not work."
  );
}

/**
 * Send a notification to a specific farmer
 * @param {string} farmerId - ID of the farmer to notify
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} type - Notification type (weather, blight, tip, diagnosis, system)
 * @param {string} priority - Notification priority (low, medium, high, urgent)
 * @param {Object} data - Additional data related to the notification
 * @param {Array} deviceTokens - Device tokens to send push to (optional)
 * @returns {Promise<Object>} Created notification
 */
const sendNotification = async (
  farmerId,
  title,
  message,
  type = "system",
  priority = "medium",
  data = {},
  deviceTokens = []
) => {
  try {
    // Find the farmer to check notification settings
    const farmer = await Farmer.findById(farmerId);
    if (!farmer) {
      throw new Error(`Farmer with ID ${farmerId} not found`);
    }

    // Check if this type of notification is enabled
    const shouldSend = checkNotificationSettings(farmer, type);
    if (!shouldSend) {
      return null; // Skip if this notification type is disabled
    }

    // Create the notification
    const notification = new Notification({
      farmerId,
      title,
      message,
      type,
      priority,
      data,
      deviceTokens:
        deviceTokens.length > 0 ? deviceTokens : farmer.deviceTokens || []
    });

    await notification.save();

    // Send push notification if enabled and we have device tokens
    if (
      farmer.notificationSettings?.enablePush &&
      notification.deviceTokens.length > 0
    ) {
      await sendPushNotification(notification);
    }

    // Send email notification if enabled for high priority notifications
    if (
      farmer.notificationSettings?.enableEmail &&
      ["high", "urgent"].includes(priority)
    ) {
      await sendEmailNotification(farmer, notification);
    }

    return notification;
  } catch (error) {
    console.error("Error sending notification:", error);
    throw error;
  }
};

/**
 * Check if a notification type is enabled in user settings
 * @param {Object} farmer - Farmer document
 * @param {string} type - Notification type
 * @returns {boolean} Whether this notification type is enabled
 */
const checkNotificationSettings = (farmer, type) => {
  if (!farmer.notificationSettings) return true; // Default to enabled if settings don't exist

  switch (type) {
    case "weather":
      return farmer.notificationSettings.weatherAlerts !== false;
    case "blight":
      return farmer.notificationSettings.blightRiskAlerts !== false;
    case "tip":
      return farmer.notificationSettings.farmingTips !== false;
    case "diagnosis":
      return farmer.notificationSettings.diagnosisResults !== false;
    case "system":
      return true; // System notifications are always enabled
    default:
      return true;
  }
};

/**
 * Send push notification using Web Push API (for PWA)
 * @param {Object} notification - Notification document
 * @returns {Promise<void>}
 */
const sendWebPushNotification = async (notification) => {
  try {
    // Skip if no device tokens
    if (!notification.deviceTokens || notification.deviceTokens.length === 0) {
      return;
    }

    // Create the message payload
    const payload = JSON.stringify({
      notification: {
        title: notification.title,
        body: notification.message,
        icon: "/android-chrome-192x192.png",
        badge: "/favicon.ico",
        vibrate: [200, 100, 200]
      },
      data: {
        notificationId: notification._id.toString(),
        type: notification.type,
        priority: notification.priority,
        url: notification.data.url || "/",
        ...notification.data // Add any additional data
      }
    });

    // Send to all registered subscriptions for this user
    const sendPromises = notification.deviceTokens.map(async (token) => {
      try {
        // Parse the token (could be a string or already an object)
        let subscription;
        try {
          subscription = typeof token === "string" ? JSON.parse(token) : token;
        } catch (err) {
          console.error("Error parsing subscription:", err);
          return { success: false, token };
        }

        // Send the notification
        await webpush.sendNotification(subscription, payload);
        return { success: true, token };
      } catch (error) {
        console.error("Error sending Web Push notification:", error);
        return { success: false, token, error };
      }
    });

    // Wait for all send operations to complete
    const results = await Promise.all(sendPromises);

    // Process results to identify and remove failed tokens
    const failedTokens = results
      .filter((result) => !result.success)
      .map((result) => result.token);

    if (failedTokens.length > 0) {
      console.log("Web Push notification failed for tokens:", failedTokens);

      // Remove failed tokens from the user
      await Farmer.findByIdAndUpdate(notification.farmerId, {
        $pull: { deviceTokens: { $in: failedTokens } }
      });
    }

    console.log(
      `Successfully sent Web Push notifications: ${
        results.filter((r) => r.success).length
      }/${notification.deviceTokens.length}`
    );
  } catch (error) {
    console.error("Error in sendWebPushNotification:", error);
    // Don't throw to prevent breaking the whole notification process
  }
};

/**
 * Send push notification using Firebase Cloud Messaging
 * @param {Object} notification - Notification document
 * @returns {Promise<void>}
 */
const sendPushNotification = async (notification) => {
  try {
    // Skip if no device tokens or Firebase not initialized
    if (!notification.deviceTokens || notification.deviceTokens.length === 0) {
      return;
    }

    // Try sending via Web Push for PWA installations
    await sendWebPushNotification(notification);

    // Also try Firebase for mobile app installations if configured
    if (admin) {
      // Filter out tokens that look like Web Push subscriptions (they have JSON structure)
      const firebaseTokens = notification.deviceTokens.filter((token) => {
        try {
          const parsed = JSON.parse(token);
          return false; // If it parses as JSON, it's likely a Web Push subscription
        } catch (e) {
          return true; // Not JSON, likely a Firebase token
        }
      });

      if (firebaseTokens.length === 0) {
        return; // No Firebase tokens to send to
      }

      // Create the message
      const message = {
        notification: {
          title: notification.title,
          body: notification.message
        },
        data: {
          notificationId: notification._id.toString(),
          type: notification.type,
          priority: notification.priority,
          ...notification.data // Add any additional data
        },
        tokens: firebaseTokens
      };

      // Send the message
      const response = await admin.messaging().sendMulticast(message);

      console.log(
        `Successfully sent Firebase push notifications: ${response.successCount}/${firebaseTokens.length}`
      );

      // If any tokens failed, log them and remove from the user's devices
      if (response.failureCount > 0) {
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(firebaseTokens[idx]);
          }
        });

        // Log failed tokens
        console.log(
          "Firebase push notification failed for tokens:",
          failedTokens
        );
      }
    }
  } catch (error) {
    console.error("Error sending push notification:", error);
    // Don't throw here to prevent breaking the whole notification process
  }
};

/**
 * Send email notification
 * @param {Object} farmer - Farmer document
 * @param {Object} notification - Notification document
 * @returns {Promise<void>}
 */
const sendEmailNotification = async (farmer, notification) => {
  try {
    // Send the email
    await sendEmail(
      farmer.email,
      farmer.firstName,
      notification.title,
      notification.message
    );
  } catch (error) {
    console.error("Error sending email notification:", error);
    // Don't throw here to prevent breaking the whole notification process
  }
};

/**
 * Mark notification as read
 * @param {string} notificationId - ID of the notification to mark as read
 * @param {string} farmerId - ID of the farmer who owns the notification
 * @returns {Promise<Object>} Updated notification
 */
const markNotificationAsRead = async (notificationId, farmerId) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, farmerId: farmerId },
      { read: true },
      { new: true }
    );

    if (!notification) {
      throw new Error("Notification not found or not owned by this farmer");
    }

    return notification;
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw error;
  }
};

/**
 * Get farmer's notifications
 * @param {string} farmerId - Farmer ID
 * @param {Object} filters - Optional filters (read status, type, etc.)
 * @param {number} limit - Maximum number of notifications to return
 * @param {number} skip - Number of notifications to skip (for pagination)
 * @returns {Promise<Array>} Notifications
 */
const getFarmerNotifications = async (
  farmerId,
  filters = {},
  limit = 20,
  skip = 0
) => {
  try {
    const query = {
      farmerId,
      expiresAt: { $gt: new Date() }
    };

    // Add read filter if specified
    if (filters.read !== undefined) {
      query.read = filters.read;
    }

    // Add type filter if specified
    if (filters.type) {
      query.type = filters.type;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    return notifications;
  } catch (error) {
    console.error("Error getting farmer notifications:", error);
    throw error;
  }
};

/**
 * Register a device token for push notifications
 * @param {string} farmerId - Farmer ID
 * @param {string} deviceToken - Device token to register
 * @returns {Promise<Object>} Updated farmer
 */
const registerDeviceToken = async (farmerId, deviceToken) => {
  try {
    if (!deviceToken) {
      throw new Error("Device token is required");
    }

    const farmer = await Farmer.findById(farmerId);
    if (!farmer) {
      throw new Error(`Farmer with ID ${farmerId} not found`);
    }

    // Initialize deviceTokens array if it doesn't exist
    if (!farmer.deviceTokens) {
      farmer.deviceTokens = [];
    }

    // Add token if it doesn't already exist
    if (!farmer.deviceTokens.includes(deviceToken)) {
      farmer.deviceTokens.push(deviceToken);
      await farmer.save();
    }

    return farmer;
  } catch (error) {
    console.error("Error registering device token:", error);
    throw error;
  }
};

module.exports = {
  sendNotification,
  markNotificationAsRead,
  getFarmerNotifications,
  registerDeviceToken
};
