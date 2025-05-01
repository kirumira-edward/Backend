const Notification = require("../models/Notification");
const Farmer = require("../models/Farmer");
const { sendEmail } = require("./emailService");
const dotenv = require("dotenv");
const { admin, messaging, isFirebaseInitialized } = require("./firebaseInit");

dotenv.config();

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
 * Send push notification using Firebase Cloud Messaging
 * @param {Object} notification - Notification document
 * @returns {Promise<void>}
 */

const sendPushNotification = async (notification) => {
  try {
    // Skip if no device tokens or Firebase not initialized
    if (!notification.deviceTokens || notification.deviceTokens.length === 0) {
      console.log("No device tokens for push notification");
      return;
    }

    // Check if Firebase is properly initialized
    if (!isFirebaseInitialized || !messaging) {
      console.error(
        "Firebase not properly initialized - skipping push notification"
      );
      console.error(
        "Make sure the FCM API is enabled in your Firebase project"
      );
      return;
    }

    console.log(
      `Sending push notification to ${notification.deviceTokens.length} devices`
    );

    // Create a simpler message format for testing
      const message = {
        notification: {
          title: notification.title,
          body: notification.message
        },
        // Avoid using data field initially for testing
        tokens: notification.deviceTokens.slice(0, 500)
      };

    try {
      // Use messaging directly from your firebaseInit.js export
       const fcmResponse = await Promise.race([
         messaging.sendMulticast(message),
         new Promise((_, reject) =>
           setTimeout(() => reject(new Error("FCM request timed out")), 10000)
         )
       ]);

       console.log(
         `Successfully sent: ${fcmResponse.successCount}/${notification.deviceTokens.length}`
       );

      // Handle failed tokens
      if (response.failureCount > 0) {
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error(
              `Error sending to token at index ${idx}:`,
              resp.error
            );
            failedTokens.push(notification.deviceTokens[idx]);
          }
        });

        // Remove failed tokens if any
        if (failedTokens.length > 0) {
          await removeFailedTokens(notification.farmerId, failedTokens);
        }
      }
    } catch (fcmError) {
      console.error(
        "Firebase messaging error:",
        fcmError.code || "unknown-error",
        fcmError.message
      );

      if (fcmError.message && fcmError.message.includes("404")) {
        console.error(
          "FCM endpoint returned 404 - check Firebase project configuration and permissions"
        );
        console.error("Common causes:");
        console.error(
          "1. Firebase Cloud Messaging API not enabled in Google Cloud Console"
        );
        console.error(
          "2. Service account doesn't have Firebase Admin SDK Admin role"
        );
        console.error("3. Project may be in a frozen state or billing issues");
      }
    }
  } catch (error) {
    console.error("Error in sendPushNotification:", error);
  }
};

// Helper to remove failed tokens
async function removeFailedTokens(farmerId, failedTokens) {
  try {
    await Farmer.findByIdAndUpdate(farmerId, {
      $pull: { deviceTokens: { $in: failedTokens } }
    });
    console.log(`Removed ${failedTokens.length} failed tokens from farmer ${farmerId}`);
  } catch (error) {
    console.error("Error removing failed tokens:", error);
  }
}

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
