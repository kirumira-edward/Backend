const {
  fetchWeatherData,
  fetchSoilMoistureData,
  extractWeatherData,
  extractSoilMoistureData
} = require("./dataServices");
const { validateEnvironmentalData } = require("./dataValidator");
const { addEnvironmentalReading } = require("./dataAggregator");
const Farmer = require("../models/Farmer");
const { sendFarmingTip } = require("./notificationTriggers");

// Track our timers
let weatherIntervalId = null;
let farmingTipsIntervalId = null;

/**
 * Fetches and processes data from both OpenWeather and ThingSpeak
 * @param {Object} coordinates - Optional user coordinates {latitude, longitude}
 * @returns {Promise<Object>} Processed environmental data
 */
const fetchAndProcessData = async (coordinates = null) => {
  try {
    console.log("Scheduled data fetch triggered at:", new Date().toISOString());

    // Default coordinates if none provided
    const locationCoords = coordinates || {
      latitude: "0.3321332652604399",
      longitude: "32.570457568263755"
    };

    // Fetch weather data
    const weatherResponse = await fetchWeatherData(
      locationCoords.latitude,
      locationCoords.longitude
    );
    const weatherData = extractWeatherData(weatherResponse);

    // Fetch soil moisture data
    let soilMoistureValue = null;
    try {
      const soilResponse = await fetchSoilMoistureData();
      const soilData = extractSoilMoistureData(soilResponse);
      soilMoistureValue = soilData.soilMoisture;
    } catch (error) {
      console.warn(
        "Soil moisture data unavailable, will use estimates:",
        error.message
      );
    }

    // Combine the data
    const combinedData = {
      ...weatherData,
      soilMoisture: soilMoistureValue,
      coordinates: locationCoords
    };

    // Validate and clean the data
    const { cleanedData, isValid, errors } =
      validateEnvironmentalData(combinedData);

    if (!isValid) {
      console.warn("Data validation warnings:", errors);
    }

    return cleanedData;
  } catch (error) {
    console.error("Error in fetchAndProcessData:", error);
    throw error;
  }
};

/**
 * Function to execute the full data collection and storage process
 * @param {Object} coordinates - Optional user coordinates
 * @param {string} farmerId - Optional farmer ID
 * @param {string} imageDiagnosis - Optional image diagnosis result
 */
const executeDataCollection = async (
  coordinates = null,
  farmerId = null,
  imageDiagnosis = null
) => {
  try {
    const data = await fetchAndProcessData(coordinates);

    // Additional validation before saving data
    if (isNaN(data.soilMoisture)) {
      console.warn("Soil moisture data is NaN. Setting default value.");
      data.soilMoisture = 50; // Set a reasonable default value
    }

    const savedData = await addEnvironmentalReading(
      data,
      farmerId,
      imageDiagnosis
    );
    console.log(
      "Data successfully stored, CRI:",
      savedData.cri,
      "Risk Level:",
      savedData.riskLevel,
      "Blight Type:",
      savedData.blightType
    );
    return savedData;
  } catch (error) {
    console.error("Error in data collection process:", error);

    // Instead of crashing, retry with default values
    try {
      console.log("Attempting to save data with default values...");
      const defaultData = {
        temperature: 22,
        humidity: 70,
        rainfall: 0,
        soilMoisture: 50,
        timestamp: new Date(),
        coordinates: coordinates || {
          latitude: "0.3321332652604399",
          longitude: "32.570457568263755"
        }
      };

      return await addEnvironmentalReading(
        defaultData,
        farmerId,
        imageDiagnosis
      );
    } catch (retryError) {
      console.error("Failed to save even with default values:", retryError);
      // Log error but avoid crashing the server
    }
  }
};

/**
 * Schedule sending of weekly farming tips
 */
const scheduleFarmingTips = () => {
  // Send farming tips once a week (in milliseconds: 7 days * 24 hours * 60 minutes * 60 seconds * 1000)
  const interval = 7 * 24 * 60 * 60 * 1000;

  console.log("Starting farming tips scheduler...");

  // Clear any existing interval
  if (farmingTipsIntervalId) {
    clearInterval(farmingTipsIntervalId);
  }

  // Set interval for farming tips
  farmingTipsIntervalId = setInterval(async () => {
    try {
      // Get all verified farmers with farming tips enabled
      const farmers = await Farmer.find({
        isVerified: true,
        "notificationSettings.farmingTips": { $ne: false } // Only send to farmers who haven't disabled tips
      });

      // Send tip to each farmer
      for (const farmer of farmers) {
        await sendFarmingTip(farmer._id);
      }

      console.log(
        `Sent farming tips to ${
          farmers.length
        } farmers at ${new Date().toISOString()}`
      );
    } catch (error) {
      console.error("Error sending scheduled farming tips:", error);
    }
  }, interval);

  // For testing/development, send one tip right away
  if (process.env.NODE_ENV === "development") {
    setTimeout(async () => {
      try {
        const farmers = await Farmer.find({ isVerified: true }).limit(2);
        if (farmers.length > 0) {
          for (const farmer of farmers) {
            await sendFarmingTip(farmer._id);
          }
          console.log(
            `Sent initial farming tips to ${farmers.length} farmers for testing`
          );
        }
      } catch (error) {
        console.error("Error sending initial farming tip:", error);
      }
    }, 10000); // Wait 10 seconds after server start
  }
};

/**
 * Starts the schedulers for data collection
 * @param {number} weatherInterval - Interval in milliseconds between weather data collections
 * @param {number} soilMoistureInterval - Interval in milliseconds between soil moisture data collections
 */
const startSchedulers = (
  weatherInterval = 4 * 60 * 60 * 1000,
  soilMoistureInterval = 30 * 60 * 1000
) => {
  // Default: 4 hours for weather, 30 minutes for soil moisture
  // Stop any existing schedulers first
  stopSchedulers();

  console.log("Starting all schedulers...");

  // Immediately fetch data when starting the scheduler
  executeDataCollection();

  // Set up regular intervals for fetching data
  weatherIntervalId = setInterval(executeDataCollection, weatherInterval);

  // Start the farming tips scheduler
  scheduleFarmingTips();

  console.log(
    `All schedulers started. Weather data will be collected every ${
      weatherInterval / (60 * 1000)
    } minutes. Farming tips will be sent weekly.`
  );

  return {
    weatherIntervalId,
    farmingTipsIntervalId
  };
};

/**
 * Stops all data collection schedulers
 */
const stopSchedulers = () => {
  if (weatherIntervalId) {
    clearInterval(weatherIntervalId);
    weatherIntervalId = null;
  }

  if (farmingTipsIntervalId) {
    clearInterval(farmingTipsIntervalId);
    farmingTipsIntervalId = null;
  }

  console.log("All schedulers stopped.");
};

module.exports = {
  startSchedulers,
  stopSchedulers,
  fetchAndProcessData,
  executeDataCollection
};
