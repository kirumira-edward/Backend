// utils/dataScheduler.js
const {
    fetchWeatherData,
    fetchSoilMoistureData,
    extractWeatherData,
    extractSoilMoistureData
  } = require("./dataServices");
  const {
    validateEnvironmentalData,
    calculateCRI
  } = require("./dataValidator");
  const EnvironmentalData = require("../models/EnvironmentalData");
  
  // Track our timers
  let weatherIntervalId = null;
  
  /**
   * Fetches and processes data from both OpenWeather and ThingSpeak
   * @returns {Promise<Object>} Processed environmental data
   */
  const fetchAndProcessData = async () => {
    try {
      console.log("Scheduled data fetch triggered at:", new Date().toISOString());
      
      // Fetch weather data
      const weatherResponse = await fetchWeatherData();
      const weatherData = extractWeatherData(weatherResponse);
  
      // Fetch soil moisture data
      let soilMoistureValue = null;
      try {
        const soilResponse = await fetchSoilMoistureData();
        const soilData = extractSoilMoistureData(soilResponse);
        soilMoistureValue = soilData.soilMoisture;
      } catch (error) {
        console.warn("Soil moisture data unavailable, will use estimates:", error.message);
      }
  
      // Combine the data
      const combinedData = {
        ...weatherData,
        soilMoisture: soilMoistureValue
      };
  
      // Validate and clean the data
      const { cleanedData, isValid, errors } = validateEnvironmentalData(combinedData);
      
      if (!isValid) {
        console.warn("Data validation warnings:", errors);
      }
  
      // Calculate CRI and risk level
      const { cri, riskLevel } = calculateCRI(cleanedData);
      
      // Add CRI and risk level to the data
      cleanedData.cri = cri;
      cleanedData.riskLevel = riskLevel;
  
      return cleanedData;
    } catch (error) {
      console.error("Error in fetchAndProcessData:", error);
      throw error;
    }
  };
  
  /**
   * Stores the environmental data in the database
   * @param {Object} data - Processed environmental data
   * @returns {Promise<Object>} Saved data document
   */
  const storeEnvironmentalData = async (data) => {
    try {
      const newData = new EnvironmentalData(data);
      return await newData.save();
    } catch (error) {
      console.error("Error storing environmental data:", error);
      throw error;
    }
  };
  
  /**
   * Function to execute the full data collection and storage process
   */
  const executeDataCollection = async () => {
    try {
      const data = await fetchAndProcessData();
      const savedData = await storeEnvironmentalData(data);
      console.log("Data successfully stored, CRI:", data.cri, "Risk Level:", data.riskLevel);
      return savedData;
    } catch (error) {
      console.error("Error in data collection process:", error);
    }
  };
  
  /**
   * Starts the schedulers for data collection
   * @param {number} weatherInterval - Weather data fetch interval in milliseconds
   * @param {number} soilMoistureInterval - Soil moisture data fetch interval in milliseconds
   */
  const startSchedulers = (weatherInterval = 3 * 60 * 60 * 1000, soilMoistureInterval = 30 * 60 * 1000) => {
    // Stop any existing schedulers first
    stopSchedulers();
    
    console.log("Starting data collection schedulers...");
    
    // Immediately fetch data when starting the scheduler
    executeDataCollection();
    
    // Set up regular intervals for fetching data
    weatherIntervalId = setInterval(executeDataCollection, weatherInterval);
    
    console.log(`Data schedulers started. Weather data will be fetched every ${weatherInterval / (60 * 1000)} minutes.`);
    
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
    storeEnvironmentalData,
    executeDataCollection
  };