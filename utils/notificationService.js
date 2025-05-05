const Notification = require("../models/Notification");
const Farmer = require("../models/Farmer");
const EnvironmentalData = require("../models/EnvironmentalData");

// Import Firebase Admin messaging instance
const { messaging } = require("./firebaseInit");

/**
 * Send push notifications using Firebase Cloud Messaging
 * @param {Array<string>} deviceTokens - Array of FCM device tokens
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} type - Notification type
 * @param {Object} data - Additional data to include with notification
 * @returns {Promise<void>}
 */
async function sendPushNotifications(deviceTokens, title, message, type, data) {
  if (!messaging) {
    console.error(
      "[sendPushNotifications] Firebase messaging is not initialized."
    );
    return;
  }
  if (!Array.isArray(deviceTokens) || deviceTokens.length === 0) {
    console.warn("[sendPushNotifications] No device tokens provided.");
    return;
  }

  // Prepare the payload
  const payload = {
    notification: {
      title: title,
      body: message
    },
    data: {
      type: type || "system",
      ...Object.fromEntries(
        Object.entries(data || {}).map(([k, v]) => [
          k,
          v == null ? "" : String(v)
        ])
      )
    }
  };

  // Send to each token individually for better error handling
  for (const token of deviceTokens) {
    try {
      const response = await messaging.send({
        token,
        ...payload,
        android: {
          priority: "high"
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              contentAvailable: true
            }
          }
        }
      });
      console.log(
        `[sendPushNotifications] Sent to ${token.substring(0, 10)}...:`,
        response
      );
    } catch (err) {
      console.error(
        `[sendPushNotifications] Error sending to ${token.substring(
          0,
          10
        )}...:`,
        err.message
      );
      // Optionally: Remove invalid tokens from DB here
    }
  }
}

/**
 * Send notification to a specific farmer
 *
 * @param {string} farmerId - ID of farmer to notify
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} type - Notification type (weather, blight, tip, diagnosis, system)
 * @param {string} priority - Notification priority (low, medium, high, urgent)
 * @param {Object} data - Additional data to include with notification
 * @returns {Promise<Object>} - The created notification
 */
const sendNotification = async (
  farmerId,
  title,
  message,
  type = "system",
  priority = "medium",
  data = {}
) => {
  try {
    // First, create a notification in our database
    const notification = new Notification({
      farmerId,
      title,
      message,
      type,
      priority,
      data
    });

    await notification.save();

    // Get the farmer to check their notification settings and device tokens
    const farmer = await Farmer.findById(farmerId);
    if (!farmer) {
      console.warn(
        `Attempted to send notification to non-existent farmer: ${farmerId}`
      );
      return notification;
    }

    // Check if they want this type of notification
    const settings = farmer.notificationSettings || {};
    const shouldSendPush = settings.enablePush !== false;

    if (!shouldSendPush) {
      console.log(`Push notifications disabled for farmer: ${farmerId}`);
      return notification;
    }

    // Send push notification if they have device tokens
    const deviceTokens = farmer.deviceTokens || [];
    if (deviceTokens.length > 0 && shouldSendPush) {
      await sendPushNotifications(deviceTokens, title, message, type, data);
    }

    return notification;
  } catch (error) {
    console.error("Error sending notification:", error);
    throw error;
  }
};

/**
 * Trigger blight risk notification based on environmental data
 * @param {Object} environmentalData - Environmental data record
 * @returns {Promise<void>}
 */
const triggerBlightRiskNotification = async (environmentalData) => {
  try {
    if (!environmentalData.farmerId) return; // Skip if no farmer is associated

    const riskLevel = environmentalData.riskLevel;
    const blightType = environmentalData.blightType;

    // Only send notifications for Medium, High, or Critical risk levels
    if (!["Medium", "High", "Critical"].includes(riskLevel)) return;

    // Determine notification priority based on risk level
    let priority = "medium";
    if (riskLevel === "High") priority = "high";
    if (riskLevel === "Critical") priority = "urgent";

    // Create notification message based on blight type
    let title = `${riskLevel} Risk of ${blightType} Detected`;
    let message = "";

    // Add a call-to-action for diagnostic confirmation
    const diagnosticCTA =
      "Take a photo of your plants now to confirm this assessment and get personalized recommendations.";

    if (blightType === "Early Blight") {
      message = `We've detected a ${riskLevel.toLowerCase()} risk of Early Blight in your area. Current CRI: ${environmentalData.cri.toFixed(
        1
      )}. `;

      // Add recommendations based on risk level
      if (riskLevel === "Medium") {
        message +=
          "Consider monitoring your plants closely and applying preventive fungicides. " +
          diagnosticCTA;
      } else if (riskLevel === "High") {
        message +=
          "Immediate action recommended: Apply approved fungicides and inspect plants daily. " +
          diagnosticCTA;
      } else if (riskLevel === "Critical") {
        message +=
          "URGENT: Apply fungicides immediately and consider removing severely affected plants to prevent spread. " +
          diagnosticCTA;
      }
    } else if (blightType === "Late Blight") {
      message = `We've detected a ${riskLevel.toLowerCase()} risk of Late Blight in your area. Current CRI: ${environmentalData.cri.toFixed(
        1
      )}. `;

      // Add recommendations based on risk level
      if (riskLevel === "Medium") {
        message +=
          "Begin preventive measures such as applying copper-based fungicides and avoiding overhead irrigation. " +
          diagnosticCTA;
      } else if (riskLevel === "High") {
        message +=
          "Apply protective fungicides immediately and reduce humidity around plants when possible. " +
          diagnosticCTA;
      } else if (riskLevel === "Critical") {
        message +=
          "URGENT: Apply fungicides immediately, remove affected plants, and consider protective measures for remaining crops. " +
          diagnosticCTA;
      }
    }

    // Send the notification with action data for deep linking
    await sendNotification(
      environmentalData.farmerId,
      title,
      message,
      "blight",
      priority,
      {
        cri: environmentalData.cri,
        riskLevel: riskLevel,
        blightType: blightType,
        date: environmentalData.date,
        action: "diagnose",
        url: "/diagnosis"
      }
    );
  } catch (error) {
    console.error("Error triggering blight risk notification:", error);
    // Log but don't throw to prevent breaking the data flow
  }
};

/**
 * Trigger weather change notification based on percentage changes
 * @param {Object} environmentalData - Environmental data record
 * @returns {Promise<void>}
 */
const triggerWeatherChangeNotification = async (environmentalData) => {
  try {
    if (!environmentalData.farmerId) return; // Skip if no farmer is associated

    const changes = environmentalData.percentageChanges?.daily;
    if (!changes) return; // Skip if no percentage changes data

    const significantChanges = [];

    // Check for significant changes (threshold values can be adjusted)
    if (changes.temperature && Math.abs(changes.temperature) >= 15) {
      significantChanges.push(
        `Temperature ${
          changes.temperature > 0 ? "increased" : "decreased"
        } by ${Math.abs(changes.temperature).toFixed(1)}%`
      );
    }

    if (changes.humidity && Math.abs(changes.humidity) >= 20) {
      significantChanges.push(
        `Humidity ${
          changes.humidity > 0 ? "increased" : "decreased"
        } by ${Math.abs(changes.humidity).toFixed(1)}%`
      );
    }

    if (changes.rainfall && changes.rainfall > 100) {
      significantChanges.push(
        `Rainfall increased by ${changes.rainfall.toFixed(1)}%`
      );
    }

    if (changes.soilMoisture && Math.abs(changes.soilMoisture) >= 25) {
      significantChanges.push(
        `Soil moisture ${
          changes.soilMoisture > 0 ? "increased" : "decreased"
        } by ${Math.abs(changes.soilMoisture).toFixed(1)}%`
      );
    }

    // If we have significant changes, send a notification
    if (significantChanges.length > 0) {
      const title = "Significant Weather Changes Detected";
      const message = `The following significant weather changes have been detected in your area: ${significantChanges.join(
        "; "
      )}. These changes may affect your crops.`;

      await sendNotification(
        environmentalData.farmerId,
        title,
        message,
        "weather",
        "medium",
        {
          changes: changes,
          date: environmentalData.date
        }
      );
    }
  } catch (error) {
    console.error("Error triggering weather change notification:", error);
    // Log but don't throw to prevent breaking the data flow
  }
};

/**
 * Send a farming tip notification
 * @param {string} farmerId - Farmer ID
 * @returns {Promise<void>}
 */
const sendFarmingTip = async (farmerId) => {
  try {
    // Array of farming tips to rotate
    const farmingTips = [
      {
        title: "Crop Rotation Tip",
        message:
          "Don't plant tomatoes in the same spot year after year. Rotate with unrelated crops to prevent disease buildup in the soil."
      },
      {
        title: "Proper Watering Technique",
        message:
          "Water tomato plants at the base rather than from overhead to keep foliage dry and reduce disease risk."
      },
      {
        title: "Pruning for Health",
        message:
          "Remove lower leaves that touch the ground to prevent soil-borne diseases from splashing onto plants."
      },
      {
        title: "Companion Planting",
        message:
          "Consider planting basil near your tomatoes - it can repel certain pests and may improve tomato flavor."
      },
      {
        title: "Mulching Benefits",
        message:
          "Apply organic mulch around tomato plants to conserve moisture, suppress weeds, and prevent soil-borne diseases."
      },
      {
        title: "Spacing Matters",
        message:
          "Ensure proper spacing between tomato plants to improve air circulation and reduce disease pressure."
      },
      {
        title: "Early Harvesting",
        message:
          "During blight-prone periods, consider harvesting tomatoes when they first show color and letting them ripen indoors."
      },
      {
        title: "Natural Fungicides",
        message:
          "A diluted milk spray (1 part milk to 9 parts water) applied weekly can help prevent early blight and powdery mildew."
      }
    ];

    // Pick a random tip
    const randomTip =
      farmingTips[Math.floor(Math.random() * farmingTips.length)];

    // Send the notification
    await sendNotification(
      farmerId,
      randomTip.title,
      randomTip.message,
      "tip",
      "low"
    );
  } catch (error) {
    console.error("Error sending farming tip:", error);
  }
};

/**
 * Trigger diagnosis result notification
 * @param {Object} diagnosis - Diagnosis record
 * @returns {Promise<void>}
 */
const triggerDiagnosisNotification = async (diagnosis) => {
  try {
    if (!diagnosis.farmerId) return;

    // Only send for completed diagnoses
    if (diagnosis.status !== "completed") return;

    let title = "Plant Diagnosis Results Available";
    let message = `Your plant diagnosis is complete. `;
    let priority = "medium";

    if (diagnosis.condition === "Healthy") {
      message += "Good news! Your plant appears to be healthy.";
    } else if (["Early Blight", "Late Blight"].includes(diagnosis.condition)) {
      title = `${diagnosis.condition} Detected in Your Plant`;
      message += `We've identified ${
        diagnosis.condition
      } with ${diagnosis.confidence.toFixed(1)}% confidence. ${
        diagnosis.recommendation
      }`;
      priority = "high";
    } else {
      message += `Condition: ${diagnosis.condition}. ${diagnosis.recommendation}`;
    }

    await sendNotification(
      diagnosis.farmerId,
      title,
      message,
      "diagnosis",
      priority,
      {
        diagnosisId: diagnosis._id,
        condition: diagnosis.condition,
        imageUrl: diagnosis.thumbnailUrl || diagnosis.imageUrl
      }
    );
  } catch (error) {
    console.error("Error triggering diagnosis notification:", error);
  }
};

module.exports = {
  sendNotification,
  triggerBlightRiskNotification,
  triggerWeatherChangeNotification,
  sendFarmingTip,
  triggerDiagnosisNotification
};
