const admin = require("firebase-admin");
const dotenv = require("dotenv");

dotenv.config();

// Parse Firebase private key correctly (needed because .env might escape newlines)
const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
  : undefined;

// Initialize Firebase Admin SDK
const initializeFirebaseAdmin = () => {
  if (admin.apps.length === 0) {
    try {
      // Check if Firebase credentials are configured
      if (!process.env.FIREBASE_PROJECT_ID) {
        console.warn(
          "Firebase credentials not configured. Push notifications will not work."
        );
        return null;
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          type: process.env.FIREBASE_TYPE,
          project_id: process.env.FIREBASE_PROJECT_ID,
          private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
          private_key: privateKey,
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
          client_id: process.env.FIREBASE_CLIENT_ID,
          auth_uri: process.env.FIREBASE_AUTH_URI,
          token_uri: process.env.FIREBASE_TOKEN_URI,
          auth_provider_x509_cert_url:
            process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
          client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
        })
      });
      console.log("Firebase Admin SDK initialized successfully");
    } catch (error) {
      console.error("Error initializing Firebase Admin SDK:", error);
      return null;
    }
  }
  return admin;
};

module.exports = {
  admin: initializeFirebaseAdmin(),
  initializeFirebaseAdmin
};
