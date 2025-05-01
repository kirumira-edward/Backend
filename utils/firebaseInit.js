const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let firebaseInitialized = false;
let messagingInitialized = false;

function initializeFirebaseAdmin() {
  try {
    // Check if already initialized
    if (admin.apps.length > 0) {
      console.log('Firebase Admin SDK already initialized');
      return true;
    }

    // Get service account
    let serviceAccount;

    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      // For production: using base64 encoded service account
      const serviceAccountJson = Buffer.from(
        process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
        'base64'
      ).toString('utf8');
      
      try {
        serviceAccount = JSON.parse(serviceAccountJson);
        console.log('Service account parsed from base64 env variable');
      } catch (parseError) {
        console.error('Failed to parse service account JSON:', parseError.message);
        return false;
      }
    } else {
      // For development: using service account file
      const serviceAccountPath = path.join(__dirname, '../config/serviceAccountKey.json');
      
      if (!fs.existsSync(serviceAccountPath)) {
        console.error('Service account file not found at:', serviceAccountPath);
        return false;
      }
      
      serviceAccount = require(serviceAccountPath);
      console.log('Service account loaded from file');
    }

    // Explicitly set project ID
    const projectId = serviceAccount.project_id;
    
    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId
      });
      
      // Test FCM explicitly
      const messagingRef = admin.messaging();
      messagingInitialized = true;
      
      console.log('✅ Firebase Admin SDK initialized successfully');
      console.log('✅ Project ID:', projectId);
      console.log('✅ Messaging service initialized');
      
      firebaseInitialized = true;
      return true;
    } catch (initError) {
      console.error('Firebase initialization error:', initError.message);
      return false;
    }
  } catch (error) {
    console.error('Error in initializeFirebaseAdmin:', error.message);
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