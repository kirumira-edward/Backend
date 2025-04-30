const axios = require("axios");

/**
 * Fetch and process weather forecast data from OpenWeather API
 * @param {string} latitude - Farm location latitude
 * @param {string} longitude - Farm location longitude
 * @returns {Promise<Object>} Processed forecast data
 */
const fetchAndProcessForecast = async (latitude, longitude) => {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  
  if (!apiKey) {
    throw new Error("OpenWeather API key not configured");
  }
  
  try {
    // Use OpenWeather 5-day forecast endpoint with metric units
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric`;
    const response = await axios.get(url);
    
    return processForecastData(response.data);
  } catch (error) {
    console.error("OpenWeather API error:", error);
    throw error;
  }
};

/**
 * Process raw forecast data from OpenWeather API
 * @param {Object} data - Raw API response
 * @returns {Array} Processed forecast data
 */
const processForecastData = (data) => {
  // Group forecast items by day
  const dailyForecasts = {};
  const forecast = [];
  
  data.list.forEach(item => {
    const date = new Date(item.dt * 1000);
    const day = date.toISOString().split('T')[0];
    
    if (!dailyForecasts[day]) {
      dailyForecasts[day] = [];
    }
    
    dailyForecasts[day].push(item);
  });
  
  // Process each day's data
  Object.keys(dailyForecasts).forEach(dayKey => {
    const items = dailyForecasts[dayKey];
    const date = new Date(dayKey);
    
    // Calculate daily min/max/avg
    const temps = items.map(item => item.main.temp);
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
    
    // Average humidity
    const avgHumidity = items.reduce((sum, item) => sum + item.main.humidity, 0) / items.length;
    
    // Calculate rain chance and amount
    const rainChance = Math.max(...items.map(item => item.pop || 0)) * 100;
    const rainfall = items.reduce((sum, item) => {
      const rainAmount = item.rain && item.rain['3h'] ? item.rain['3h'] : 0;
      return sum + rainAmount;
    }, 0);
    
    // Use noon forecast for the icon/description
    const midDayForecast = items[Math.floor(items.length / 2)];
    
    // Calculate blight risk based on weather conditions
    const blightRisk = calculateBlightRisk(avgTemp, avgHumidity, rainfall, rainChance);
    
    // Add to forecast array
    forecast.push({
      date: dayKey,
      day: new Date(dayKey).toLocaleDateString('en-US', { weekday: 'short' }),
      temperature: {
        min: Math.round(minTemp * 10) / 10,
        max: Math.round(maxTemp * 10) / 10,
        avg: Math.round(avgTemp * 10) / 10
      },
      humidity: Math.round(avgHumidity),
      rainChance: Math.round(rainChance),
      rainfall: Math.round(rainfall * 10) / 10,
      description: midDayForecast.weather[0].description,
      icon: midDayForecast.weather[0].icon,
      predictedCRI: calculateCRI(avgTemp, avgHumidity, rainfall),
      blightRisk
    });
  });
  
  return forecast;
};

/**
 * Calculate predicted CRI value based on weather conditions
 */
const calculateCRI = (temperature, humidity, rainfall) => {
  let cri = 50; // Baseline
  
  // Temperature effects
  if (temperature < 10) {
    cri -= 10;
  } else if (temperature < 15) {
    cri -= 5;
  } else if (temperature > 27) {
    cri -= 5;
  } else if (temperature > 30) {
    cri -= 10;
  } else if (temperature >= 18 && temperature <= 25) {
    cri += 15; // Optimal range
  }
  
  // Humidity effects 
  if (humidity > 90) {
    cri -= 15; // Too wet
  } else if (humidity > 75) {
    cri += 15; // High humidity favors blight
  } else if (humidity < 40) {
    cri -= 15; // Too dry
  }
  
  // Rainfall effects
  if (rainfall > 5) {
    cri -= 10; // Heavy rain can wash spores
  } else if (rainfall > 0 && rainfall <= 5) {
    cri += 10; // Light rain favors blight
  }
  
  return Math.max(0, Math.min(100, Math.round(cri)));
};

/**
 * Determine blight risk level and type based on conditions
 */
const calculateBlightRisk = (temperature, humidity, rainfall, rainChance) => {
  // Default risk
  let level = "Low";
  let type = "Healthy";
  
  // Late blight conditions (cooler, very humid)
  if (temperature < 20 && humidity > 85 && (rainfall > 0 || rainChance > 50)) {
    type = "Late Blight";
    level = humidity > 90 ? "High" : "Medium";
  }
  // Early blight conditions (warmer, humid)
  else if (temperature > 24 && humidity > 75) {
    type = "Early Blight";
    level = humidity > 85 ? "High" : "Medium";
  }
  
  // Increase risk level for extreme conditions
  if (humidity > 90 && rainfall > 2 && temperature >= 15 && temperature <= 25) {
    level = "Critical";
  }
  
  return { level, type };
};

module.exports = { fetchAndProcessForecast };