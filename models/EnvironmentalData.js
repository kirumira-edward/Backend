// models/EnvironmentalData.js
const mongoose = require("mongoose");

const environmentalDataSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      required: true,
      default: Date.now
    },
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
    windSpeed: {
      type: Number
    },
    cloudCover: {
      type: Number
    },
    locationId: {
      type: String,
      default: "default-location"
    },
    dataSource: {
      type: String,
      enum: ["api", "sensor", "combined"],
      default: "combined"
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
    }
  },
  { timestamps: true }
);

// Create compound index for efficient querying by date range and location
environmentalDataSchema.index({ timestamp: 1, locationId: 1 });

const EnvironmentalData = mongoose.model("EnvironmentalData", environmentalDataSchema);
module.exports = EnvironmentalData;