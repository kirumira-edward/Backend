const {
  fetchWeatherData,
  fetchSoilMoistureData,
  extractWeatherData,
  extractSoilMoistureData
} = require("./dataServices");
const { validateEnvironmentalData } = require("./dataValidator");
const { addEnvironmentalReading } = require("./dataAggregator");

// Track our timers
let weatherIntervalId = null;

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
      savedData.blightType // Added blight type to the log
    );
    return savedData;
  } catch (error) {
    console.error("Error in data collection process:", error);
    throw error;
  }
};

/**
 * Starts the schedulers for data collection
 * @param {number} interval - Interval in milliseconds between data collections
 */
const startSchedulers = (interval = 4 * 60 * 60 * 1000) => {
  // Default: 4 hours (6 times a day)
  // Stop any existing schedulers first
  stopSchedulers();

  console.log("Starting data collection schedulers...");

  // Immediately fetch data when starting the scheduler
  executeDataCollection();

  // Set up regular intervals for fetching data
  weatherIntervalId = setInterval(executeDataCollection, interval);

  console.log(
    `Data scheduler started. Data will be collected every ${
      interval / (60 * 1000)
    } minutes.`
  );

  return {
    weatherIntervalId
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

  console.log("Data collection schedulers stopped.");
};

module.exports = {
  startSchedulers,
  stopSchedulers,
  fetchAndProcessData,
  executeDataCollection
};
