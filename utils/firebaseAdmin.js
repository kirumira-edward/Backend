const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let firebaseInitialized = false;
let firebaseApp = null;

try {
  // Check if we have environment variables for Firebase
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    // For production: using base64 encoded service account from environment variable
    const serviceAccountJson = Buffer.from(
      process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 
      'base64'
    ).toString('utf8');
    
    const serviceAccount = JSON.parse(serviceAccountJson);
    
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
    
    firebaseInitialized = true;
    console.log('Firebase Admin SDK initialized with environment variables');
    console.log('Using project ID:', serviceAccount.project_id);
  } 
  else {
    // For development: using service account file
    const serviceAccountPath = path.join(
      __dirname, 
      '../config/serviceAccountKey.json'
    );
    
    // Check if the file exists
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      
      firebaseInitialized = true;
      console.log('Firebase Admin SDK initialized with service account file');
      console.log('Using project ID:', serviceAccount.project_id);
    } else {
      console.error('Firebase service account file not found at:', serviceAccountPath);
    }
  }
  
  // Test FCM initialization
  if (firebaseInitialized) {
    const messaging = admin.messaging();
    console.log('Firebase Cloud Messaging initialized successfully');
  }
  
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error.message);
  if (error.code) {
    console.error('Error code:', error.code);
    console.error('Error details:', error);
  }
}

module.exports = { 
  admin: firebaseInitialized ? admin : null,
  messaging: firebaseInitialized ? admin.messaging() : null,
  isFirebaseInitialized: firebaseInitialized
};