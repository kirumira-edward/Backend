// utils/dataAggregator.js
const EnvironmentalData = require("../models/EnvironmentalData");
const { calculateCRI } = require("./dataValidator");

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
 * Add a new environmental data reading
 * @param {Object} readingData - The individual reading data
 * @param {string} farmerId - Optional farmer ID to associate with the reading
 * @returns {Promise<Object>} The updated or created daily record
 */
const addEnvironmentalReading = async (readingData, farmerId = null) => {
  try {
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
      const { cri, riskLevel, blightType } = calculateCRI({
        temperature: dailyRecord.temperature,
        humidity: dailyRecord.humidity,
        soilMoisture: dailyRecord.soilMoisture,
        rainfall: dailyRecord.rainfall
      });

      dailyRecord.cri = cri;
      dailyRecord.riskLevel = riskLevel;
      dailyRecord.blightType = blightType;

      // Calculate percentage changes
      await calculateAndUpdatePercentageChanges(dailyRecord);

      // Save and return
      return await dailyRecord.save();
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
      const { cri, riskLevel } = calculateCRI({
        temperature: reading.temperature,
        humidity: reading.humidity,
        soilMoisture: reading.soilMoisture,
        rainfall: reading.rainfall || 0
      });

      newDailyRecord.cri = cri;
      newDailyRecord.riskLevel = riskLevel;

      // Calculate percentage changes
      await calculateAndUpdatePercentageChanges(newDailyRecord);

      // Save and return
      return await newDailyRecord.save();
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
        temperature: calculatePercentageChange(dailyRecord.temperature, yesterdayRecord.temperature),
        humidity: calculatePercentageChange(dailyRecord.humidity, yesterdayRecord.humidity),
        rainfall: calculatePercentageChange(dailyRecord.rainfall, yesterdayRecord.rainfall),
        soilMoisture: calculatePercentageChange(dailyRecord.soilMoisture, yesterdayRecord.soilMoisture),
        cri: calculatePercentageChange(dailyRecord.cri, yesterdayRecord.cri)
      };
    }
    
    // Calculate weekly changes
    if (lastWeekRecord) {
      dailyRecord.percentageChanges.weekly = {
        temperature: calculatePercentageChange(dailyRecord.temperature, lastWeekRecord.temperature),
        humidity: calculatePercentageChange(dailyRecord.humidity, lastWeekRecord.humidity),
        rainfall: calculatePercentageChange(dailyRecord.rainfall, lastWeekRecord.rainfall),
        soilMoisture: calculatePercentageChange(dailyRecord.soilMoisture, lastWeekRecord.soilMoisture),
        cri: calculatePercentageChange(dailyRecord.cri, lastWeekRecord.cri)
      };
    }
    
    // Calculate monthly changes
    if (lastMonthRecord) {
      dailyRecord.percentageChanges.monthly = {
        temperature: calculatePercentageChange(dailyRecord.temperature, lastMonthRecord.temperature),
        humidity: calculatePercentageChange(dailyRecord.humidity, lastMonthRecord.humidity),
        rainfall: calculatePercentageChange(dailyRecord.rainfall, lastMonthRecord.rainfall),
        soilMoisture: calculatePercentageChange(dailyRecord.soilMoisture, lastMonthRecord.soilMoisture),
        cri: calculatePercentageChange(dailyRecord.cri, lastMonthRecord.cri)
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