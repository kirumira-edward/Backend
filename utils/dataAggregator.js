const EnvironmentalData = require("../models/EnvironmentalData");
const { calculateCRI } = require("./dataValidator");
const {
  triggerBlightRiskNotification,
  triggerWeatherChangeNotification
} = require("./notificationTriggers");

/**
 * Calculates the average of an array of numbers
 * @param {Array<number>} numbers - Array of numbers to average
 * @returns {number} The average value or 0 if array is empty
 */
const calculateAverage = (numbers) => {
  if (!numbers || numbers.length === 0) return 0;
  const sum = numbers.reduce((acc, val) => acc + val, 0);
  return sum / numbers.length;
};

/**
 * Calculate percentage change between two values
 * @param {number} newValue - Current value
 * @param {number} oldValue - Previous value to compare against
 * @returns {number} Percentage change (positive for increase, negative for decrease)
 */
const calculatePercentageChange = (newValue, oldValue) => {
  if (oldValue === 0) return newValue > 0 ? 100 : 0;
  return ((newValue - oldValue) / Math.abs(oldValue)) * 100;
};

/**
 * Adjusts CRI based on image diagnosis
 * @param {number} cri - The calculated CRI value
 * @param {string} imageDiagnosis - The result of the image diagnosis
 * @returns {Object} Adjusted CRI, riskLevel, and blightType
 */
const adjustCRIBasedOnDiagnosis = (cri, imageDiagnosis) => {
  let adjustedCRI = cri;
  let riskLevel;
  let blightType;

  if (imageDiagnosis && typeof imageDiagnosis === "string") {
    if (imageDiagnosis.toLowerCase().includes("early blight")) {
      if (adjustedCRI >= 50) {
        adjustedCRI = Math.max(1, adjustedCRI - 20); // Example: Reduce CRI by 20
      }
      blightType = "Early Blight";
      if (adjustedCRI >= 40) riskLevel = "Low";
      else if (adjustedCRI >= 30) riskLevel = "Medium";
      else if (adjustedCRI >= 20) riskLevel = "High";
      else riskLevel = "Critical";
    } else if (imageDiagnosis.toLowerCase().includes("late blight")) {
      if (adjustedCRI <= 50) {
        adjustedCRI = Math.min(100, adjustedCRI + 20); // Example: Increase CRI by 20
      }
      blightType = "Late Blight";
      if (adjustedCRI <= 60) riskLevel = "Low";
      else if (adjustedCRI <= 70) riskLevel = "Medium";
      else if (adjustedCRI <= 80) riskLevel = "High";
      else riskLevel = "Critical";
    } else if (imageDiagnosis.toLowerCase().includes("healthy")) {
      adjustedCRI = 50;
      riskLevel = "Low";
      blightType = "Healthy";
    } else {
      // If diagnosis is something else or not recognized, use the calculated CRI
      if (adjustedCRI < 50) {
        blightType = "Early Blight";
        if (adjustedCRI >= 40) riskLevel = "Low";
        else if (adjustedCRI >= 30) riskLevel = "Medium";
        else if (adjustedCRI >= 20) riskLevel = "High";
        else riskLevel = "Critical";
      } else if (adjustedCRI > 50) {
        blightType = "Late Blight";
        if (adjustedCRI <= 60) riskLevel = "Low";
        else if (adjustedCRI <= 70) riskLevel = "Medium";
        else if (adjustedCRI <= 80) riskLevel = "High";
        else riskLevel = "Critical";
      } else {
        riskLevel = "Low";
        blightType = "Healthy";
      }
    }
  } else {
    // If no diagnosis is provided, use the calculated CRI's risk level and blight type
    if (adjustedCRI < 50) {
      blightType = "Early Blight";
      if (adjustedCRI >= 40) riskLevel = "Low";
      else if (adjustedCRI >= 30) riskLevel = "Medium";
      else if (adjustedCRI >= 20) riskLevel = "High";
      else riskLevel = "Critical";
    } else if (adjustedCRI > 50) {
      blightType = "Late Blight";
      if (adjustedCRI <= 60) riskLevel = "Low";
      else if (adjustedCRI <= 70) riskLevel = "Medium";
      else if (adjustedCRI <= 80) riskLevel = "High";
      else riskLevel = "Critical";
    } else {
      riskLevel = "Low";
      blightType = "Healthy";
    }
  }

  return {
    adjustedCRI: parseFloat(adjustedCRI.toFixed(2)),
    riskLevel,
    blightType
  };
};

/**
 * Add a new environmental data reading
 * @param {Object} readingData - The individual reading data
 * @param {string} farmerId - Optional farmer ID to associate with the reading
 * @param {string} imageDiagnosis - Optional image diagnosis result
 * @returns {Promise<Object>} The updated or created daily record
 */
const addEnvironmentalReading = async (
  readingData,
  farmerId = null,
  imageDiagnosis = null
) => {
  try {
    // Ensure soilMoisture is valid
    if (isNaN(readingData.soilMoisture)) {
      console.warn(
        "Invalid soil moisture value (NaN). Using estimate from rainfall."
      );
      readingData.soilMoisture = estimateSoilMoisture(
        readingData.rainfall || 0
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to beginning of day

    // Find existing record for today
    const query = {
      date: today,
      "coordinates.latitude": readingData.coordinates?.latitude,
      "coordinates.longitude": readingData.coordinates?.longitude
    };

    // Add farmerId to query if provided
    if (farmerId) {
      query.farmerId = farmerId;
    }

    let dailyRecord = await EnvironmentalData.findOne(query);

    // Extract relevant data for the reading
    const reading = {
      timestamp: readingData.timestamp || new Date(),
      temperature: readingData.temperature,
      humidity: readingData.humidity,
      rainfall: readingData.rainfall,
      soilMoisture: readingData.soilMoisture
    };

    // Final check to ensure no NaN values in the reading
    Object.keys(reading).forEach((key) => {
      if (typeof reading[key] === "number" && isNaN(reading[key])) {
        if (key === "soilMoisture") {
          reading[key] = estimateSoilMoisture(reading.rainfall || 0);
        } else if (key === "rainfall") {
          reading[key] = 0;
        }
      }
    });

    if (dailyRecord) {
      // Add reading to existing record
      dailyRecord.readings.push(reading);

      // Update averages
      const temperatures = dailyRecord.readings
        .map((r) => r.temperature)
        .filter(Boolean);
      const humidities = dailyRecord.readings
        .map((r) => r.humidity)
        .filter(Boolean);
      const soilMoistures = dailyRecord.readings
        .map((r) => r.soilMoisture)
        .filter(Boolean);

      // Calculate total rainfall (sum not average)
      const totalRainfall = dailyRecord.readings.reduce(
        (sum, r) => sum + (r.rainfall || 0),
        0
      );

      // Update daily averages
      dailyRecord.temperature = calculateAverage(temperatures);
      dailyRecord.humidity = calculateAverage(humidities);
      dailyRecord.soilMoisture = calculateAverage(soilMoistures);
      dailyRecord.rainfall = totalRainfall;

      // Recalculate CRI based on the new averages
      const { cri } = calculateCRI({
        temperature: dailyRecord.temperature,
        humidity: dailyRecord.humidity,
        soilMoisture: dailyRecord.soilMoisture,
        rainfall: dailyRecord.rainfall
      });

      // Adjust CRI based on image diagnosis
      const { adjustedCRI, riskLevel, blightType } = adjustCRIBasedOnDiagnosis(
        cri,
        imageDiagnosis
      );
      dailyRecord.cri = adjustedCRI;
      dailyRecord.riskLevel = riskLevel;
      dailyRecord.blightType = blightType;

      // Calculate percentage changes
      await calculateAndUpdatePercentageChanges(dailyRecord);

      // Save the record
      await dailyRecord.save();

      // Trigger notifications if farmerId exists
      if (farmerId) {
        await Promise.all([
          triggerBlightRiskNotification(dailyRecord),
          triggerWeatherChangeNotification(dailyRecord)
        ]);
      }

      // Return the saved record
      return dailyRecord;
    } else {
      // Create new daily record
      const newDailyRecord = new EnvironmentalData({
        date: today,
        readings: [reading],
        temperature: reading.temperature,
        humidity: reading.humidity,
        rainfall: reading.rainfall || 0,
        soilMoisture: reading.soilMoisture,
        locationId: readingData.locationId,
        coordinates: readingData.coordinates,
        farmerId: farmerId
      });

      // Calculate CRI
      const { cri } = calculateCRI({
        temperature: reading.temperature,
        humidity: reading.humidity,
        soilMoisture: reading.soilMoisture,
        rainfall: reading.rainfall || 0
      });

      // Adjust CRI based on image diagnosis
      const { adjustedCRI, riskLevel, blightType } = adjustCRIBasedOnDiagnosis(
        cri,
        imageDiagnosis
      );
      newDailyRecord.cri = adjustedCRI;
      newDailyRecord.riskLevel = riskLevel;
      newDailyRecord.blightType = blightType;

      // Calculate percentage changes
      await calculateAndUpdatePercentageChanges(newDailyRecord);

      // Save the record
      await newDailyRecord.save();

      // Trigger notifications if farmerId exists
      if (farmerId) {
        await Promise.all([
          triggerBlightRiskNotification(newDailyRecord),
          triggerWeatherChangeNotification(newDailyRecord)
        ]);
      }

      // Return the saved record
      return newDailyRecord;
    }
  } catch (error) {
    console.error("Error adding environmental reading:", error);
    throw error;
  }
};

/**
 * Calculate and update percentage changes for a daily record
 * @param {Object} dailyRecord - The daily environmental data record
 */
const calculateAndUpdatePercentageChanges = async (dailyRecord) => {
  try {
    // Get yesterday's record
    const yesterday = new Date(dailyRecord.date);
    yesterday.setDate(yesterday.getDate() - 1);

    const yesterdayRecord = await EnvironmentalData.findOne({
      date: yesterday,
      locationId: dailyRecord.locationId
    });

    // Get last week's record
    const lastWeek = new Date(dailyRecord.date);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const lastWeekRecord = await EnvironmentalData.findOne({
      date: lastWeek,
      locationId: dailyRecord.locationId
    });

    // Get last month's record
    const lastMonth = new Date(dailyRecord.date);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const lastMonthRecord = await EnvironmentalData.findOne({
      date: lastMonth,
      locationId: dailyRecord.locationId
    });

    // Initialize percentage changes object
    dailyRecord.percentageChanges = {
      daily: {},
      weekly: {},
      monthly: {}
    };

    // Calculate daily changes
    if (yesterdayRecord) {
      dailyRecord.percentageChanges.daily = {
        temperature: calculatePercentageChange(
          dailyRecord.temperature,
          yesterdayRecord.temperature
        )?.toFixed(1),
        humidity: calculatePercentageChange(
          dailyRecord.humidity,
          yesterdayRecord.humidity
        )?.toFixed(1),
        rainfall: calculatePercentageChange(
          dailyRecord.rainfall,
          yesterdayRecord.rainfall
        )?.toFixed(1),
        soilMoisture: calculatePercentageChange(
          dailyRecord.soilMoisture,
          yesterdayRecord.soilMoisture
        )?.toFixed(1),
        cri: calculatePercentageChange(
          dailyRecord.cri,
          yesterdayRecord.cri
        )?.toFixed(1)
      };
    }

    // Calculate weekly changes
    if (lastWeekRecord) {
      dailyRecord.percentageChanges.weekly = {
        temperature: calculatePercentageChange(
          dailyRecord.temperature,
          lastWeekRecord.temperature
        )?.toFixed(1),
        humidity: calculatePercentageChange(
          dailyRecord.humidity,
          lastWeekRecord.humidity
        )?.toFixed(1),
        rainfall: calculatePercentageChange(
          dailyRecord.rainfall,
          lastWeekRecord.rainfall
        )?.toFixed(1),
        soilMoisture: calculatePercentageChange(
          dailyRecord.soilMoisture,
          lastWeekRecord.soilMoisture
        )?.toFixed(1),
        cri: calculatePercentageChange(
          dailyRecord.cri,
          lastWeekRecord.cri
        )?.toFixed(1)
      };
    }

    // Calculate monthly changes
    if (lastMonthRecord) {
      dailyRecord.percentageChanges.monthly = {
        temperature: calculatePercentageChange(
          dailyRecord.temperature,
          lastMonthRecord.temperature
        )?.toFixed(1),
        humidity: calculatePercentageChange(
          dailyRecord.humidity,
          lastMonthRecord.humidity
        )?.toFixed(1),
        rainfall: calculatePercentageChange(
          dailyRecord.rainfall,
          lastMonthRecord.rainfall
        )?.toFixed(1),
        soilMoisture: calculatePercentageChange(
          dailyRecord.soilMoisture,
          lastMonthRecord.soilMoisture
        )?.toFixed(1),
        cri: calculatePercentageChange(
          dailyRecord.cri,
          lastMonthRecord.cri
        )?.toFixed(1)
      };
    }
  } catch (error) {
    console.error("Error calculating percentage changes:", error);
    // Don't throw error to avoid breaking the entire process
  }
};

module.exports = {
  addEnvironmentalReading,
  calculatePercentageChange,
  calculateAverage
};
