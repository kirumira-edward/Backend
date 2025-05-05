const axios = require("axios");

/**
 * Fetches weather data from OpenWeather API
 * @param {string} lat - Latitude coordinate
 * @param {string} lon - Longitude coordinate
 * @param {string} apiKey - OpenWeather API key
 * @returns {Promise<Object>} Weather data response
 */
const fetchWeatherData = async (
  lat = "0.3321332652604399",
  lon = "32.570457568263755",
  apiKey = process.env.OPENWEATHER_API_KEY
) => {
  try {
    const response = await axios.get(
      `http://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching weather data:", error.message);
    throw new Error("Failed to fetch weather data");
  }
};

/**
 * Fetches soil moisture data from ThingSpeak API
 * @param {string} channelId - ThingSpeak channel ID
 * @param {string} fieldNumber - Field number to retrieve
 * @param {string} apiKey - ThingSpeak API key
 * @returns {Promise<Object>} Soil moisture data response
 */
const fetchSoilMoistureData = async (
  channelId = process.env.THINGSPEAK_CHANNEL,
  fieldNumber = "5",
  apiKey = process.env.THINGSPEAK_API_KEY
) => {
  try {
    const response = await axios.get(
      `https://api.thingspeak.com/channels/${channelId}/fields/${fieldNumber}.json?api_key=${apiKey}&results=1`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching soil moisture data:", error.message);
    throw new Error("Failed to fetch soil moisture data");
  }
};

/**
 * Extracts relevant weather data from OpenWeather API response
 * @param {Object} weatherData - Raw weather data from OpenWeather API
 * @returns {Object} Extracted weather parameters
 */
const extractWeatherData = (weatherData) => {
  // Extract current weather data (first item in the list)
  const currentWeather = weatherData.list[0];

  return {
    timestamp: new Date(currentWeather.dt * 1000), // Convert Unix timestamp to Date
    temperature: parseFloat((currentWeather.main.temp - 273.15).toFixed(2)), // Convert from Kelvin to Celsius
    humidity: currentWeather.main.humidity,
    rainfall: currentWeather.rain ? currentWeather.rain["3h"] || 0 : 0, // 3-hour rainfall in mm
    locationId: `${weatherData.city.name}`
  };
};

/**
 * Extracts soil moisture data from ThingSpeak API response
 * @param {Object} soilData - Raw soil data from ThingSpeak API
 * @returns {Object} Extracted soil moisture value
 */
const extractSoilMoistureData = (soilData, fieldNumber = "5") => {
  if (!soilData || !soilData.feeds || soilData.feeds.length === 0) {
    throw new Error("Invalid soil moisture data format");
  }

  // Get the latest reading
  const latestReading = soilData.feeds[soilData.feeds.length - 1];
  const fieldName = `field${fieldNumber}`;

  return {
    soilMoisture: parseFloat(latestReading[fieldName]),
    timestamp: new Date(latestReading.created_at)
  };
};

/**
 * Estimate soil moisture based on recent rainfall
 * @param {number} rainfall - Recent rainfall in mm
 * @returns {number} Estimated soil moisture percentage (0-100)
 */
const estimateSoilMoisture = (rainfall) => {
  // Base moisture level (40-50%)
  const baseMoisture = 40 + Math.random() * 10;

  // Increase by rainfall amount (each mm adds 2-5%)
  const rainfallEffect = rainfall * (2 + Math.random() * 3);

  // Ensure within 0-100% range
  return Math.min(100, Math.max(0, baseMoisture + rainfallEffect));
};

// Generate mock environmental data for development or when no data is available
const generateMockEnvironmentalData = () => {
  const now = new Date();

  // Generate random but realistic values
  const temperature = (20 + Math.random() * 10).toFixed(1); // 20-30°C
  const humidity = Math.round(40 + Math.random() * 50); // 40-90%
  const rainfall = (Math.random() * 5).toFixed(1); // 0-5mm
  const soilMoisture = Math.round(30 + Math.random() * 50); // 30-80%

  // Calculate CRI based on these values (simplified version)
  let cri = 50; // Baseline

  // Adjust based on temperature (cooler temps favor late blight, warmer favor early blight)
  if (temperature < 22) {
    cri += (22 - temperature) * 2; // Move toward late blight (higher CRI)
  } else if (temperature > 24) {
    cri -= (temperature - 24) * 2; // Move toward early blight (lower CRI)
  }

  // Adjust based on humidity (higher humidity favors late blight)
  if (humidity > 75) {
    cri += (humidity - 75) / 5;
  } else if (humidity < 60) {
    cri -= (60 - humidity) / 5;
  }

  // Ensure CRI is within bounds
  cri = Math.max(1, Math.min(100, cri));

  // Determine risk level and blight type based on CRI
  let riskLevel, blightType;

  if (cri < 50) {
    blightType = "Early Blight";
    if (cri >= 40) riskLevel = "Low";
    else if (cri >= 30) riskLevel = "Medium";
    else if (cri >= 20) riskLevel = "High";
    else riskLevel = "Critical";
  } else if (cri > 50) {
    blightType = "Late Blight";
    if (cri <= 60) riskLevel = "Low";
    else if (cri <= 70) riskLevel = "Medium";
    else if (cri <= 80) riskLevel = "High";
    else riskLevel = "Critical";
  } else {
    riskLevel = "Low";
    blightType = "Healthy";
  }

  return {
    date: now,
    temperature: parseFloat(temperature),
    humidity: humidity,
    rainfall: parseFloat(rainfall),
    soilMoisture: soilMoisture,
    cri: parseFloat(cri.toFixed(2)),
    riskLevel,
    blightType,
    percentageChanges: {
      daily: {
        temperature: (Math.random() * 10 - 5).toFixed(1),
        humidity: (Math.random() * 10 - 5).toFixed(1),
        rainfall: (Math.random() * 100).toFixed(1),
        soilMoisture: (Math.random() * 10 - 5).toFixed(1),
        cri: (Math.random() * 6 - 3).toFixed(1)
      },
      weekly: {},
      monthly: {}
    }
  };
};

module.exports = {
  fetchWeatherData,
  fetchSoilMoistureData,
  extractWeatherData,
  extractSoilMoistureData,
  estimateSoilMoisture,
  generateMockEnvironmentalData
};
