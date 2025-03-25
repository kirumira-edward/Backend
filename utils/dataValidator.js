const { estimateSoilMoisture } = require("./dataServices");

/**
 * Validates and cleans environmental data
 * @param {Object} data - Raw environmental data
 * @returns {Object} Cleaned data, validity flag, and errors
 */
const validateEnvironmentalData = (data) => {
  const errors = [];
  const cleanedData = { ...data };

  // Validate temperature
  if (
    cleanedData.temperature === undefined ||
    cleanedData.temperature === null
  ) {
    errors.push("Temperature data missing");
    cleanedData.temperature = 22; // Default to moderate temperature
  }

  // Validate humidity
  if (cleanedData.humidity === undefined || cleanedData.humidity === null) {
    errors.push("Humidity data missing");
    cleanedData.humidity = 70; // Default to moderate humidity
  }

  // Handle missing soil moisture by estimating from rainfall if available
  if (
    cleanedData.soilMoisture === undefined ||
    cleanedData.soilMoisture === null
  ) {
    errors.push("Soil moisture data missing, will use estimate");
    // Use the estimateSoilMoisture function to calculate a value based on rainfall
    cleanedData.soilMoisture = estimateSoilMoisture(cleanedData.rainfall || 0);
  }

  return {
    cleanedData,
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Calculates Cumulative Risk Index (CRI) based on environmental factors
 * @param {Object} data - Environmental data
 * @returns {Object} CRI value and risk level
 */
const calculateCRI = (data) => {

  // Make sure we have soil moisture data, estimate if not available
  if (data.soilMoisture === undefined || data.soilMoisture === null) {
    data.soilMoisture = estimateSoilMoisture(data.rainfall || 0);
  }

  // Define weights for different factors
  const weights = {
    humidity: 0.4,
    temperature: 0.4,
    soilMoisture: 0.2
  };

  // Start with healthy baseline CRI of 50
  let cri = 50;

  // Temperature factor:
  // - Early blight favors warmer temps (24-29°C) - pushes CRI below 50
  // - Late blight favors cooler temps (10-20°C) - pushes CRI above 50
  // - 21-23°C is the balanced range (near 50)
  let tempFactor = 0;
  if (data.temperature < 10 || data.temperature > 29) {
    // Extreme temperatures are less conducive to either blight
    tempFactor = 0;
  } else if (data.temperature >= 10 && data.temperature <= 20) {
    // Cool temperatures favor late blight (positive shift)
    tempFactor = 25 * (1 - (data.temperature - 10) / 10); // Max +25 at 10°C
  } else if (data.temperature >= 24 && data.temperature <= 29) {
    // Warm temperatures favor early blight (negative shift)
    tempFactor = -25 * (1 - (29 - data.temperature) / 5); // Max -25 at 29°C
  } else {
    // 21-23°C is optimal range, minimal impact
    tempFactor = 0;
  }

  // Humidity factor:
  // - Early blight can develop at lower humidity (< 60%) - pushes CRI below 50
  // - Late blight requires high humidity (> 80%) - pushes CRI above 50
  // - 60-80% is the balanced range
  let humidityFactor = 0;
  if (data.humidity > 80) {
    // High humidity favors late blight (positive shift)
    humidityFactor = 30 * ((data.humidity - 80) / 20); // Max +30 at 100% humidity
  } else if (data.humidity < 60) {
    // Low humidity can favor early blight (negative shift)
    humidityFactor = -20 * ((60 - data.humidity) / 60); // Max -20 at 0% humidity
  } else {
    // 60-80% humidity has minimal impact
    humidityFactor = 0;
  }

  // Soil moisture factor:
  // - Early blight favors drier soil (< 40%) - pushes CRI below 50
  // - Late blight favors wetter soil (> 60%) - pushes CRI above 50
  // - 40-60% is the balanced range
  let soilFactor = 0;
  if (data.soilMoisture > 60) {
    // Wet soil favors late blight (positive shift)
    soilFactor = 25 * ((data.soilMoisture - 60) / 40); // Max +25 at 100% moisture
  } else if (data.soilMoisture < 40) {
    // Dry soil can favor early blight (negative shift)
    soilFactor = -25 * ((40 - data.soilMoisture) / 40); // Max -25 at 0% moisture
  } else {
    // 40-60% moisture has minimal impact
    soilFactor = 0;
  }

  // Apply weighted factors to baseline CRI
  cri +=
    tempFactor * weights.temperature +
    humidityFactor * weights.humidity +
    soilFactor * weights.soilMoisture;

  // Ensure CRI stays within 1-100 range
  cri = Math.min(Math.max(cri, 1), 100);

  // Determine risk level based on new bidirectional CRI with more granular classification
  let riskLevel;
  let blightType = null;

  // Categorize based on Early Blight risk (CRI < 50)
  if (cri < 50) {
     blightType = "Early Blight";
     if (cri >= 40) {
       riskLevel = "Low";
     } else if (cri >= 30) {
       riskLevel = "Medium";
     } else if (cri >= 20) {
       riskLevel = "High";
     } else {
       riskLevel = "Critical";
     }
  }
  // Categorize based on Late Blight risk (CRI > 50)
  else if (cri > 50) {
    blightType = "Late Blight";
    if (cri <= 60) {
      riskLevel = "Low";
    } else if (cri <= 70) {
      riskLevel = "Medium";
    } else if (cri <= 80) {
      riskLevel = "High";
    } else {
      riskLevel = "Critical";
    }
  }
  // Healthy range (CRI = 50)
  else {
    riskLevel = "Low";
    blightType = "Healthy";
  }

  return {
    cri: parseFloat(cri.toFixed(2)),
    riskLevel,
    blightType
  };
};

module.exports = {
  validateEnvironmentalData,
  calculateCRI
};