const axios = require("axios");

/**
 * Fetches weather data from OpenWeather API
 * @param {string} lat - Latitude coordinate
 * @param {string} lon - Longitude coordinate
 * @param {string} apiKey - OpenWeather API key
 * @returns {Promise<Object>} Weather data response
 */
const fetchWeatherData = async (lat = "0.3321332652604399", lon = "32.570457568263755", apiKey = process.env.OPENWEATHER_API_KEY) => {
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
  fieldNumber = "1",
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
    rainfall: currentWeather.rain ? (currentWeather.rain["3h"] || 0) : 0, // 3-hour rainfall in mm
    locationId: `${weatherData.city.name}`
  };
};

/**
 * Extracts soil moisture data from ThingSpeak API response
 * @param {Object} soilData - Raw soil data from ThingSpeak API
 * @returns {Object} Extracted soil moisture value
 */
const extractSoilMoistureData = (soilData) => {
  if (!soilData || !soilData.feeds || soilData.feeds.length === 0) {
    throw new Error("Invalid soil moisture data format");
  }
  
  // Get the latest reading
  const latestReading = soilData.feeds[soilData.feeds.length - 1];
  
  return {
    soilMoisture: parseFloat(latestReading.field1),
    timestamp: new Date(latestReading.created_at)
  };
};

/**
 * Estimates soil moisture based on rainfall if sensor data is unavailable
 * @param {number} rainfall - Rainfall amount in mm
 * @param {number} historicalAvg - Historical average soil moisture (default 30%)
 * @returns {number} Estimated soil moisture percentage
 */
const estimateSoilMoisture = (rainfall, historicalAvg = 30) => {
  // Simple model: historical average + (rainfall * 2)
  // Each mm of rain increases soil moisture by approximately 2%
  let estimatedMoisture = historicalAvg + (rainfall * 2);
  
  // Clamp values between 10% and 100%
  return Math.min(Math.max(estimatedMoisture, 10), 100);
};

module.exports = {
  fetchWeatherData,
  fetchSoilMoistureData,
  extractWeatherData,
  extractSoilMoistureData,
  estimateSoilMoisture
};