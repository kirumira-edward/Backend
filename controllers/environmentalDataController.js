// controllers/environmentalDataController.js
const EnvironmentalData = require("../models/EnvironmentalData");
const { executeDataCollection } = require("../utils/dataScheduler");

/**
 * Fetches the latest environmental data from APIs and saves to database
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const refreshEnvironmentalData = async (req, res) => {
  try {
    const savedData = await executeDataCollection();
    
    res.status(200).json({
      message: "Environmental data refreshed successfully",
      data: savedData
    });
  } catch (error) {
    console.error("Error refreshing environmental data:", error);
    res.status(500).json({ message: "Failed to refresh environmental data", error: error.message });
  }
};

/**
 * Retrieves the latest environmental data from the database
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getLatestEnvironmentalData = async (req, res) => {
  try {
    const data = await EnvironmentalData.findOne()
      .sort({ timestamp: -1 })
      .exec();

    if (!data) {
      return res.status(404).json({ message: "No environmental data found" });
    }

    res.status(200).json(data);
  } catch (error) {
    console.error("Error retrieving latest environmental data:", error);
    res.status(500).json({ message: "Failed to retrieve environmental data", error: error.message });
  }
};

/**
 * Retrieves environmental data within a date range
 * @param {Object} req - Express request object with startDate and endDate query params
 * @param {Object} res - Express response object
 */
const getEnvironmentalDataRange = async (req, res) => {
  try {
    const { startDate, endDate, locationId } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "startDate and endDate are required query parameters" });
    }

    const query = {
      timestamp: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };

    // Add locationId to query if provided
    if (locationId) {
      query.locationId = locationId;
    }

    const data = await EnvironmentalData.find(query)
      .sort({ timestamp: 1 })
      .exec();

    res.status(200).json(data);
  } catch (error) {
    console.error("Error retrieving environmental data range:", error);
    res.status(500).json({ message: "Failed to retrieve environmental data range", error: error.message });
  }
};

module.exports = {
  refreshEnvironmentalData,
  getLatestEnvironmentalData,
  getEnvironmentalDataRange
};