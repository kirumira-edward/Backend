// utils/cloudinaryService.js
const cloudinary = require("cloudinary").v2;
const dotenv = require("dotenv");

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload a profile image to Cloudinary
 * @param {String|Buffer} imageData - Base64 string or Buffer of image data
 * @param {String} userId - User ID for the image
 * @returns {Promise<Object>} Cloudinary upload result
 */
const uploadProfileImage = async (imageData, userId) => {
  try {
    const result = await cloudinary.uploader.upload(imageData, {
      folder: "tomato-blight-ai/profiles",
      public_id: `farmer_${userId}`,
      overwrite: true,
      transformation: [
        { width: 400, height: 400, crop: "fill", gravity: "face" }
      ]
    });

    return {
      url: result.secure_url,
      publicId: result.public_id
    };
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    throw new Error("Failed to upload profile image");
  }
};

/**
 * Upload a plant diagnosis image to Cloudinary
 * @param {String|Buffer} imageData - Base64 string or Buffer of image data
 * @param {String} userId - User ID for the image
 * @param {Object} metadata - Additional metadata for the image
 * @returns {Promise<Object>} Cloudinary upload result
 */
const uploadDiagnosisImage = async (imageData, userId, metadata = {}) => {
  try {
    // Generate unique ID for diagnosis image
    const uniqueId = `${userId}_${Date.now()}`;

    // Upload with original resolution - important for diagnosis
    const result = await cloudinary.uploader.upload(imageData, {
      folder: "tomato-blight-ai/diagnosis",
      public_id: uniqueId,
      resource_type: "image",
      // Add metadata for later analysis
      context: `user_id=${userId}${
        metadata.location ? `|location=${metadata.location}` : ""
      }${metadata.plant_type ? `|plant_type=${metadata.plant_type}` : ""}`,
      // Store the original image for accurate diagnosis
      eager: [
        // Also create a thumbnail version for UI display
        { width: 300, height: 300, crop: "fill" }
      ]
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      thumbnailUrl: result.eager[0].secure_url
    };
  } catch (error) {
    console.error("Error uploading diagnosis image to Cloudinary:", error);
    throw new Error("Failed to upload diagnosis image");
  }
};

/**
 * Delete an image from Cloudinary
 * @param {String} publicId - Cloudinary public ID of the image
 * @returns {Promise<Object>} Deletion result
 */
const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error("Error deleting image from Cloudinary:", error);
    throw new Error("Failed to delete image");
  }
};

/**
 * Get a signed URL for retrieving an image with transformations
 * For example, applying AI diagnosis overlays
 * @param {String} publicId - Cloudinary public ID of the image
 * @param {Array} transformations - Array of transformation objects
 * @returns {String} Signed URL
 */
const getTransformedImageUrl = (publicId, transformations = []) => {
  return cloudinary.url(publicId, {
    secure: true,
    transformation: transformations
  });
};

module.exports = {
  uploadProfileImage,
  uploadDiagnosisImage,
  deleteImage,
  getTransformedImageUrl
};
