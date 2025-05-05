const Diagnosis = require("../models/Diagnosis");
const mongoose = require("mongoose");
const EnvironmentalData = require("../models/EnvironmentalData");
const {
  validateImage,
  diagnoseTomatoDisease
} = require("../utils/geminiService");
const { uploadDiagnosisImage } = require("../utils/cloudinaryService");
const { calculateCRI } = require("../utils/dataValidator");
const {
  triggerDiagnosisNotification
} = require("../utils/notificationTriggers");
const { sendDiagnosisEmail } = require("../utils/emailService"); // Add this import
const axios = require("axios"); // Import axios

/**
 * Validate a tomato plant image before diagnosis
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const validatePlantImage = async (req, res) => {
  try {
    // Validate request
    const { image, coordinates } = req.body;

    if (!image) {
      return res.status(400).json({ message: "Image data is required" });
    }

    // Extract base64 image data
    const base64Image = image.includes("base64,")
      ? image.split("base64,")[1]
      : image;

    console.log("Validating image...");

    // Validate the image with Gemini
    const validation = await validateImage(base64Image);

    if (!validation.is_valid) {
      return res.status(400).json({
        message: "Invalid image",
        details: validation.message
      });
    }

    console.log("Image validation passed");

    // Upload image to Cloudinary
    const metadata = {
      location: JSON.stringify(coordinates),
      plant_type: "tomato"
    };

    const uploadResult = await uploadDiagnosisImage(
      image,
      req.user.id,
      metadata
    );
    console.log("Image uploaded to Cloudinary");

    // Create a pending diagnosis record
    const pendingDiagnosis = new Diagnosis({
      farmerId: req.user.id,
      imageUrl: uploadResult.url,
      thumbnailUrl: uploadResult.thumbnailUrl,
      publicId: uploadResult.publicId,
      condition: "Pending",
      confidence: 0,
      recommendation: "Pending diagnosis. Please wait for analysis.",
      cri: 0,
      coordinates: coordinates,
      status: "validated"
    });

    await pendingDiagnosis.save();

    res.status(200).json({
      message: "Image validated successfully",
      validationId: pendingDiagnosis._id,
      imageUrl: pendingDiagnosis.thumbnailUrl || pendingDiagnosis.imageUrl
    });
  } catch (error) {
    console.error("Error validating plant image:", error);
    res.status(500).json({
      message: "Failed to validate image",
      error: error.message
    });
  }
};

/**
 * Diagnose a previously validated tomato plant image
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const diagnosePlant = async (req, res) => {
  try {
    const { validationId } = req.body;

    if (!validationId) {
      return res.status(400).json({ message: "Validation ID is required" });
    }

    // Find the validated image
    const pendingDiagnosis = await Diagnosis.findOne({
      _id: validationId,
      farmerId: req.user.id,
      status: "validated"
    });

    if (!pendingDiagnosis) {
      return res.status(404).json({
        message: "Validated image not found"
      });
    }

    const imageUrl = pendingDiagnosis.imageUrl;

    // Fetch the image data from the URL and convert to base64
    try {
      const response = await axios.get(imageUrl, {
        responseType: "arraybuffer"
      });
      const buffer = Buffer.from(response.data, "binary");
      const base64Image = buffer.toString("base64");
      console.log("Length of base64Image:", base64Image.length); // Log the length
      // Now use base64Image in your call to diagnoseTomatoDisease
      const lastEnvironmentalData = await EnvironmentalData.findOne({
        farmerId: req.user.id
      })
        .sort({ date: -1 })
        .exec();

      if (!lastEnvironmentalData) {
        return res.status(404).json({
          message:
            "No environmental data found. Please refresh environmental data first."
        });
      }

      const currentCRI = lastEnvironmentalData.cri;
      console.log(`Using historical CRI value: ${currentCRI}`);

      const diagnosisResult = await diagnoseTomatoDisease(
        base64Image,
        currentCRI
      );

      console.log("Raw diagnosis result:", JSON.stringify(diagnosisResult));

      let farmerMessage = "";
      let adjustedCRI = currentCRI;

      // Extract condition from diagnosisResult with validation to avoid "Unknown" results
      const condition = diagnosisResult.condition || "Unknown";
      const confidence = diagnosisResult.confidence || 0;

      // Extract recommendations, handling both string and array formats
      const recommendation = Array.isArray(diagnosisResult.recommendations)
        ? diagnosisResult.recommendations.join(" ")
        : diagnosisResult.recommendation ||
          "No specific recommendations available.";

      // Extract symptoms data, handling both field name variations
      const signsAndSymptoms =
        diagnosisResult.symptoms || diagnosisResult.signs_and_symptoms || "";

      // Compare CRI with image diagnosis and adjust CRI
      const criLikelihood =
        currentCRI < 50
          ? "Early Blight"
          : currentCRI > 50
          ? "Late Blight"
          : "Healthy";
      const imageDiagnosis = condition;
      const diagnosisConfidence = confidence;

      if (imageDiagnosis !== "Unknown") {
        if (
          (criLikelihood === "Early Blight" &&
            imageDiagnosis === "Late Blight") ||
          (criLikelihood === "Late Blight" &&
            imageDiagnosis === "Early Blight") ||
          (criLikelihood !== "Healthy" && imageDiagnosis === "Healthy") ||
          (criLikelihood === "Healthy" && imageDiagnosis !== "Healthy")
        ) {
          farmerMessage = `The system's calculated risk index (CRI) suggests a likelihood of ${criLikelihood} (CRI: ${currentCRI}), which contradicts the image analysis result of ${imageDiagnosis}. The system will adjust the CRI accordingly.`;

          // Logic to adjust CRI based on contradiction and Gemini's confidence
          const adjustmentFactor = (diagnosisConfidence / 100) * 10; // Adjust by up to 10 points based on confidence

          if (
            criLikelihood === "Early Blight" &&
            imageDiagnosis === "Late Blight"
          ) {
            adjustedCRI = Math.min(100, currentCRI + adjustmentFactor);
          } else if (
            criLikelihood === "Late Blight" &&
            imageDiagnosis === "Early Blight"
          ) {
            adjustedCRI = Math.max(1, currentCRI - adjustmentFactor);
          } else if (
            criLikelihood !== "Healthy" &&
            imageDiagnosis === "Healthy"
          ) {
            adjustedCRI = Math.max(
              1,
              Math.min(
                100,
                currentCRI + (50 - currentCRI) * adjustmentFactor * 0.5
              )
            ); // Move towards 50
          } else if (
            criLikelihood === "Healthy" &&
            imageDiagnosis !== "Healthy"
          ) {
            if (imageDiagnosis === "Early Blight") {
              adjustedCRI = Math.max(1, currentCRI - adjustmentFactor);
            } else if (imageDiagnosis === "Late Blight") {
              adjustedCRI = Math.min(100, currentCRI + adjustmentFactor);
            }
          }
          console.log(`CRI adjusted from ${currentCRI} to ${adjustedCRI}`);

          // Update the environmental data with the adjusted CRI
          await EnvironmentalData.updateOne(
            { _id: lastEnvironmentalData._id },
            { $set: { cri: adjustedCRI } }
          );
        }
      }

      // Update the pending diagnosis with results
      pendingDiagnosis.condition = condition;
      pendingDiagnosis.confidence = confidence;
      pendingDiagnosis.recommendation = recommendation;
      pendingDiagnosis.cri = currentCRI; // Store the CRI at the time of diagnosis
      pendingDiagnosis.status = "completed";
      pendingDiagnosis.environmentalDataId = lastEnvironmentalData._id;
      pendingDiagnosis.signsAndSymptoms = signsAndSymptoms;

      await pendingDiagnosis.save();
      console.log("Diagnosis saved to database");

      try {
        // Send a notification about the diagnosis result
        console.log(
          "Triggering diagnosis notification for condition:",
          pendingDiagnosis.condition
        );
        await triggerDiagnosisNotification(pendingDiagnosis);
      } catch (notificationError) {
        console.error(
          "Error sending diagnosis notification:",
          notificationError
        );
        // Don't fail the entire request if notification fails
      }

      // --- ADD EMAIL SENDING LOGIC HERE ---
      try {
        // Fetch farmer's email and first name
        const farmer = await require("../models/Farmer")
          .findById(req.user.id)
          .lean();
        if (farmer && farmer.email && farmer.firstName) {
          await sendDiagnosisEmail(farmer.email, farmer.firstName, {
            condition: pendingDiagnosis.condition,
            confidence: pendingDiagnosis.confidence,
            recommendation: pendingDiagnosis.recommendation,
            signs_and_symptoms: pendingDiagnosis.signsAndSymptoms
          });
          console.log("Diagnosis email sent to:", farmer.email);
        } else {
          console.warn(
            "Farmer email or first name missing, cannot send diagnosis email."
          );
        }
      } catch (emailError) {
        console.error("Error sending diagnosis email:", emailError);
        // Don't fail the request if email fails
      }
      // --- END EMAIL SENDING LOGIC ---

      // Return results to client
      res.status(200).json({
        message: "Diagnosis complete",
        farmerMessage: farmerMessage,
        diagnosis: {
          id: pendingDiagnosis._id,
          condition: pendingDiagnosis.condition,
          confidence: pendingDiagnosis.confidence,
          recommendation: pendingDiagnosis.recommendation,
          imageUrl: pendingDiagnosis.imageUrl,
          thumbnailUrl: pendingDiagnosis.thumbnailUrl,
          createdAt: pendingDiagnosis.createdAt,
          coordinates: pendingDiagnosis.coordinates,
          signsAndSymptoms: pendingDiagnosis.signsAndSymptoms,
          environmentalData: {
            cri: adjustedCRI,
            riskLevel: lastEnvironmentalData.riskLevel,
            temperature: lastEnvironmentalData.temperature,
            humidity: lastEnvironmentalData.humidity,
            rainfall: lastEnvironmentalData.rainfall,
            soilMoisture: lastEnvironmentalData.soilMoisture
          }
        }
      });
    } catch (error) {
      console.error("Error fetching or encoding image:", error);
      return res.status(500).json({
        message: "Failed to fetch or encode image for diagnosis",
        error: error.message
      });
    }
  } catch (error) {
    console.error("Error in plant diagnosis:", error);
    res.status(500).json({
      message: "Failed to diagnose plant",
      error: error.message
    });
  }
};

/**
 * Get diagnosis history for a farmer
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getDiagnosisHistory = async (req, res) => {
  try {
    const { limit = 10, skip = 0 } = req.query;

    const diagnoses = await Diagnosis.find({ farmerId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .populate(
        "environmentalDataId",
        "temperature humidity rainfall soilMoisture cri riskLevel"
      )
      .exec();

    const total = await Diagnosis.countDocuments({ farmerId: req.user.id });

    // Transform MongoDB documents to match frontend expectations
    const transformedDiagnoses = diagnoses.map((diagnosis) => ({
      id: diagnosis._id.toString(),
      condition: diagnosis.condition,
      confidence: diagnosis.confidence,
      recommendation: diagnosis.recommendation,
      imageUrl: diagnosis.imageUrl,
      thumbnailUrl: diagnosis.thumbnailUrl,
      createdAt: diagnosis.createdAt,
      coordinates: diagnosis.coordinates,
      status: diagnosis.status,
      environmentalData: diagnosis.environmentalDataId
        ? {
            cri: diagnosis.environmentalDataId.cri,
            riskLevel: diagnosis.environmentalDataId.riskLevel,
            temperature: diagnosis.environmentalDataId.temperature,
            humidity: diagnosis.environmentalDataId.humidity,
            rainfall: diagnosis.environmentalDataId.rainfall,
            soilMoisture: diagnosis.environmentalDataId.soilMoisture
          }
        : null,
      signsAndSymptoms: diagnosis.signsAndSymptoms // Include signs and symptoms in history
    }));

    res.status(200).json({
      diagnoses: transformedDiagnoses,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip)
      }
    });
  } catch (error) {
    console.error("Error fetching diagnosis history:", error);
    res.status(500).json({
      message: "Failed to fetch diagnosis history",
      error: error.message
    });
  }
};

/**
 * Get a specific diagnosis by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getDiagnosisById = async (req, res) => {
  try {
    // Log and validate the ID parameter
    console.log("Requested diagnosis ID:", req.params.id);

    if (!req.params.id || req.params.id === "undefined") {
      return res.status(400).json({
        message: "Invalid diagnosis ID",
        error: "A valid diagnosis ID is required"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.log(`Invalid ObjectId format: "${req.params.id}"`);
      return res.status(400).json({
        message: "Invalid diagnosis ID format",
        error: "The provided ID is not a valid MongoDB ObjectId"
      });
    }

    const diagnosis = await Diagnosis.findOne({
      _id: req.params.id,
      farmerId: req.user.id
    })
      .populate(
        "environmentalDataId",
        "temperature humidity rainfall soilMoisture cri riskLevel date"
      )
      .exec();

    if (!diagnosis) {
      return res.status(404).json({ message: "Diagnosis not found" });
    }

    const environmentalData = diagnosis.environmentalDataId
      ? {
          cri: diagnosis.environmentalDataId.cri,
          riskLevel: diagnosis.environmentalDataId.riskLevel,
          temperature: diagnosis.environmentalDataId.temperature,
          humidity: diagnosis.environmentalDataId.humidity,
          rainfall: diagnosis.environmentalDataId.rainfall,
          soilMoisture: diagnosis.environmentalDataId.soilMoisture,
          date: diagnosis.environmentalDataId.date
        }
      : null;

    res.status(200).json({
      id: diagnosis._id.toString(),
      condition: diagnosis.condition,
      confidence: diagnosis.confidence,
      recommendation: diagnosis.recommendation,
      imageUrl: diagnosis.imageUrl,
      thumbnailUrl: diagnosis.thumbnailUrl,
      createdAt: diagnosis.createdAt,
      coordinates: diagnosis.coordinates,
      status: diagnosis.status,
      environmentalData: environmentalData,
      signsAndSymptoms: diagnosis.signsAndSymptoms // Include signs and symptoms in get by ID
    });
  } catch (error) {
    console.error("Error fetching diagnosis:", error);
    res.status(500).json({
      message: "Failed to fetch diagnosis",
      error: error.message
    });
  }
};

module.exports = {
  validatePlantImage,
  diagnosePlant,
  getDiagnosisHistory,
  getDiagnosisById
};
