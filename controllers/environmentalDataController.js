// controllers/environmentalDataController.js
const EnvironmentalData = require("../models/EnvironmentalData");
const Farmer = require("../models/Farmer");
const { executeDataCollection } = require("../utils/dataScheduler");

/**
 * Fetches the latest environmental data from APIs and saves to database
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */

const refreshEnvironmentalData = async (req, res) => {
  try {
    // Get user coordinates if provided
    const coordinates = req.body.coordinates || null;

    // Pass the farmerId from the authenticated user
    const savedData = await executeDataCollection(coordinates, req.user.id);

    res.status(200).json({
      message: "Environmental data refreshed successfully",
      data: savedData
    });
  } catch (error) {
    console.error("Error refreshing environmental data:", error);
    res
      .status(500)
      .json({
        message: "Failed to refresh environmental data",
        error: error.message
      });
  }
};

/**
 * Retrieves the latest environmental data from the database
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getLatestEnvironmentalData = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Create a query that filters by date
    const query = { date: { $gte: today } };

    // If user is authenticated, filter by their farmerId
    if (req.user && req.user.id) {
      query.farmerId = req.user.id;
    }

    const data = await EnvironmentalData.findOne(query)
      .sort({ date: -1 })
      .exec();

    if (!data) {
      return res
        .status(404)
        .json({ message: "No environmental data found for today" });
    }

    // Format response with percentages
    const response = {
      date: data.date,
      currentConditions: {
        temperature: `${data.temperature.toFixed(1)}°C`,
        humidity: `${data.humidity.toFixed(0)}%`,
        rainfall: `${data.rainfall.toFixed(1)}mm`,
        soilMoisture: `${
          data.soilMoisture ? data.soilMoisture.toFixed(0) : "N/A"
        }%`
      },
      cri: data.cri,
      riskLevel: data.riskLevel,
      percentageChanges: data.percentageChanges || {
        daily: {},
        weekly: {},
        monthly: {}
      }
    };

    res.status(200).json(response);
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

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const query = {
      date: {
        $gte: start,
        $lte: end
      },
      farmerId: req.user.id
    };

    // Add locationId to query if provided
    if (locationId) {
      query.locationId = locationId;
    }

    const data = await EnvironmentalData.find(query)
      .sort({ date: 1 })
      .exec();

    res.status(200).json(data);
  } catch (error) {
    console.error("Error retrieving environmental data range:", error);
    res.status(500).json({ message: "Failed to retrieve environmental data range", error: error.message });
  }
};

/**
 * Get CRI history and trends
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getCRIHistory = async (req, res) => {
  try {
    const { period, locationId } = req.query;
    
    // Default to last 30 days if period not specified
    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    
    switch(period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'quarter':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30); // Default to 30 days
    }
    
    const query = {
      date: { $gte: startDate },
      farmerId: req.user.id
    };
    
    if (locationId) {
      query.locationId = locationId;
    }
    
    // Get data sorted by date
    const data = await EnvironmentalData.find(query)
      .select('date cri riskLevel percentageChanges')
      .sort({ date: 1 })
      .lean()
      .exec();
    
    if (!data || data.length === 0) {
      return res.status(404).json({ message: "No CRI history found for the specified period" });
    }
    
    // Calculate overall trend (average of daily changes)
    const criChanges = data
      .filter(day => day.percentageChanges?.daily?.cri !== undefined)
      .map(day => day.percentageChanges.daily.cri);
    
    const averageCRIChange = criChanges.length > 0 
      ? criChanges.reduce((sum, change) => sum + change, 0) / criChanges.length 
      : 0;
    
    res.status(200).json({
      history: data,
      trend: {
        averageChange: averageCRIChange,
        direction: averageCRIChange > 0 ? 'increasing' : averageCRIChange < 0 ? 'decreasing' : 'stable'
      }
    });
    
  } catch (error) {
    console.error("Error retrieving CRI history:", error);
    res.status(500).json({ message: "Failed to retrieve CRI history", error: error.message });
  }
};

/**
 * Endpoint to update user's location coordinates
 * @param {Object} req - Express request object with coordinates in body
 * @param {Object} res - Express response object
 */
const updateUserLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res
        .status(400)
        .json({ message: "Latitude and longitude are required" });
    }

    // Update the farmer's default location
    await Farmer.findByIdAndUpdate(req.user.id, {
      defaultLocation: { latitude, longitude }
    });

    // Store coordinates in user session or profile
    // For now, just return success and use these coordinates for the next data fetch
    res.status(200).json({
      message: "Location updated successfully",
      coordinates: { latitude, longitude }
    });

    // Optionally trigger a data fetch with the new coordinates
    executeDataCollection({ latitude, longitude }, req.user.id).catch((err) =>
      console.error("Error fetching data with new coordinates:", err)
    );
  } catch (error) {
    console.error("Error updating user location:", error);
    res.status(500).json({ message: "Failed to update location", error: error.message });
  }
};

module.exports = {
  refreshEnvironmentalData,
  getLatestEnvironmentalData,
  getEnvironmentalDataRange,
  getCRIHistory,
  updateUserLocation
};