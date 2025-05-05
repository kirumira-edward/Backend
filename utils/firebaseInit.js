const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let firebaseInitialized = false;
let messagingInitialized = false;

function initializeFirebaseAdmin() {
  try {
    // Check if already initialized
    if (admin.apps.length > 0) {
      console.log("Firebase Admin SDK already initialized");
      return true;
    }

    // Always use the service account file for now
    const serviceAccountPath = path.join(
      __dirname,
      "../config/serviceAccountKey.json"
    );

    if (!fs.existsSync(serviceAccountPath)) {
      console.error("Service account file not found at:", serviceAccountPath);
      return false;
    }

    const serviceAccount = require(serviceAccountPath);
    console.log("Service account loaded from file");

    // Initialize with direct file reference
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    // Test FCM explicitly with debugging
    try {
      const messagingRef = admin.messaging();
      console.log("✅ Firebase Cloud Messaging initialized successfully");
      console.log("Available messaging methods:", Object.keys(messagingRef));
      messagingInitialized = true;
    } catch (fcmError) {
      console.error(
        "❌ Failed to initialize Firebase Cloud Messaging:",
        fcmError
      );
    }

    firebaseInitialized = true;
    return true;
  } catch (error) {
    console.error("Error in initializeFirebaseAdmin:", error);
    return false;
  }
}

// Initialize immediately
const initialized = initializeFirebaseAdmin();

module.exports = {
  admin,
  messaging: messagingInitialized ? admin.messaging() : null,
  isFirebaseInitialized: firebaseInitialized,
  initializeFirebaseAdmin
};