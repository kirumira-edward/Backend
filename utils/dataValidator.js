const { estimateSoilMoisture } = require("./dataServices");

/**
 * Validates and cleans environmental data
 * @param {Object} data - Raw environmental data
 * @returns {Object} Cleaned and validated data
 */
const validateEnvironmentalData = (data) => {
  const cleanedData = { ...data };
  const errors = [];

  // Validate temperature (must be a float)
  if (typeof cleanedData.temperature !== 'number' || isNaN(cleanedData.temperature)) {
    errors.push("Invalid temperature value");
    cleanedData.temperature = null;
  }

  // Validate humidity (must be between 0-100)
  if (typeof cleanedData.humidity !== 'number' || isNaN(cleanedData.humidity) || 
      cleanedData.humidity < 0 || cleanedData.humidity > 100) {
    errors.push("Invalid humidity value");
    cleanedData.humidity = null;
  }

  // Validate soil moisture (must be between 0-100)
  if (cleanedData.soilMoisture) {
    if (typeof cleanedData.soilMoisture !== 'number' || isNaN(cleanedData.soilMoisture) || 
        cleanedData.soilMoisture < 0 || cleanedData.soilMoisture > 100) {
      errors.push("Invalid soil moisture value");
      cleanedData.soilMoisture = null;
    }
  }

  // Validate rainfall (must be a non-negative number)
  if (typeof cleanedData.rainfall !== 'number' || isNaN(cleanedData.rainfall) || cleanedData.rainfall < 0) {
    errors.push("Invalid rainfall value");
    cleanedData.rainfall = 0;
  }

  // If soil moisture is missing, estimate it from rainfall
  if (cleanedData.soilMoisture === null || cleanedData.soilMoisture === undefined) {
    cleanedData.soilMoisture = estimateSoilMoisture(cleanedData.rainfall);
  }

  return {
    cleanedData,
    errors,
    isValid: errors.length === 0
  };
};

/**
 * Calculates Cumulative Risk Index (CRI) based on environmental factors
 * @param {Object} data - Environmental data
 * @returns {Object} CRI value and risk level
 */
const calculateCRI = (data) => {
  // Define weights for different factors
  const weights = {
    humidity: 0.5,
    temperature: 0.3,
    soilMoisture: 0.2
  };

  // Base CRI calculation
  let cri = 0;
  
  // Temperature risk (optimal for blight is 10-25°C)
  const tempFactor = data.temperature >= 10 && data.temperature <= 25 ? 
    (1 - Math.abs((data.temperature - 17.5) / 7.5)) * 100 : 0;
  
  // Humidity risk (higher humidity increases risk, optimal for blight is >80%)
  const humidityFactor = data.humidity >= 80 ? 
    ((data.humidity - 80) / 20) * 100 + 50 : (data.humidity / 80) * 50;
  
  // Soil moisture risk (optimal for blight is >60%)
  const soilFactor = data.soilMoisture >= 60 ? 
    ((data.soilMoisture - 60) / 40) * 100 : (data.soilMoisture / 60) * 50;

  // Calculate weighted CRI
  cri = (humidityFactor * weights.humidity) + 
        (tempFactor * weights.temperature) + 
        (soilFactor * weights.soilMoisture);
  
  // Clamp CRI between 0 and 100
  cri = Math.min(Math.max(cri, 0), 100);

  // Determine risk level based on CRI
  let riskLevel;
  if (cri < 25) {
    riskLevel = "Low";
  } else if (cri < 50) {
    riskLevel = "Medium";
  } else if (cri < 75) {
    riskLevel = "High";
  } else {
    riskLevel = "Critical";
  }

  return {
    cri: parseFloat(cri.toFixed(2)),
    riskLevel
  };
};

module.exports = {
  validateEnvironmentalData,
  calculateCRI
};