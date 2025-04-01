const mongoose = require("mongoose");

const DiagnosisSchema = new mongoose.Schema(
  {
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Farmer"
    },
    imageUrl: {
      type: String,
      required: true
    },
    thumbnailUrl: {
      type: String
    },
    publicId: {
      type: String,
      required: true
    },
    condition: {
      type: String,
      required: true,
      enum: ["Pending", "Healthy", "Early Blight", "Late Blight", "Unknown"],
      default: "Pending"
    },
    confidence: {
      type: Number,
      default: 0
    },
    recommendation: {
      type: String,
      default: "Pending"
    },
    cri: {
      type: Number,
      default: 0
    },
    coordinates: {
      type: Object, // Store latitude and longitude
      default: {}
    },
    status: {
      type: String,
      enum: ["pending", "validated", "completed", "failed"],
      default: "pending"
    },
    environmentalDataId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EnvironmentalData"
    },
    signsAndSymptoms: {
      type: String
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Diagnosis", DiagnosisSchema);
