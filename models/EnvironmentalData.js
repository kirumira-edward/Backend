// models/EnvironmentalData.js
const mongoose = require("mongoose");

// Schema for individual readings throughout the day
const dataReadingSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    required: true
  },
  temperature: Number,
  humidity: Number,
  rainfall: Number,
  soilMoisture: Number
});

// Main environmental data schema - now storing daily data
const environmentalDataSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      index: true
    },
    // Add farmer reference
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farmer",
      index: true
    },
    // Daily average values
    temperature: {
      type: Number,
      required: true
    },
    humidity: {
      type: Number,
      required: true
    },
    rainfall: {
      type: Number,
      default: 0
    },
    soilMoisture: {
      type: Number
    },
    // Store all readings for the day
    readings: [dataReadingSchema],
    // Location data
    locationId: {
      type: String,
      default: "default-location"
    },
    riskLevel: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Low"
    },
    // Type of blight risk
    blightType: {
      type: String,
      enum: ["Healthy", "Early Blight", "Late Blight"],
      default: "Healthy"
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    // Calculated risk index (0-100)
    cri: {
      type: Number,
      default: 0
    },
    // Risk level based on CRI
    riskLevel: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Low"
    },
    // Percentage changes
    percentageChanges: {
      daily: {
        temperature: Number,
        humidity: Number,
        rainfall: Number,
        soilMoisture: Number,
        cri: Number
      },
      weekly: {
        temperature: Number,
        humidity: Number,
        rainfall: Number,
        soilMoisture: Number,
        cri: Number
      },
      monthly: {
        temperature: Number,
        humidity: Number,
        rainfall: Number,
        soilMoisture: Number,
        cri: Number
      }
    }
  },
  { timestamps: true }
);

// Create compound indexes for efficient querying
environmentalDataSchema.index({ date: 1, locationId: 1 });
environmentalDataSchema.index({ farmerId: 1, date: 1 });

const EnvironmentalData = mongoose.model("EnvironmentalData", environmentalDataSchema);
module.exports = EnvironmentalData;