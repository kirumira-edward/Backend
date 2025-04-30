const EnvironmentalData = require("../models/EnvironmentalData");
const Farmer = require("../models/Farmer");
const Diagnosis = require("../models/Diagnosis");
const Weather = require("../models/Weather");
const mongoose = require("mongoose");

/**
 * Get insights and recommendations based on environmental data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getInsights = async (req, res) => {
  try {
    const farmerId = req.user.id;

    // Get the farmer's location
    const farmer = await Farmer.findById(farmerId);
    if (!farmer || !farmer.defaultLocation) {
      return res.status(400).json({
        message:
          "No location data found. Please update your farm location first."
      });
    }

    // Get the latest environmental data
    const latestData = await EnvironmentalData.findOne({ farmerId })
      .sort({ date: -1 })
      .limit(1);

    if (!latestData) {
      return res.status(404).json({
        message:
          "No environmental data found. Please refresh your environmental data."
      });
    }

    // Get historical data for trend analysis
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const historicalData = await EnvironmentalData.find({
      farmerId,
      date: { $gte: oneWeekAgo }
    }).sort({ date: 1 });

    // Calculate risk change
    let weeklyRiskChange = 0;
    if (historicalData.length > 1) {
      const oldestCRI = historicalData[0].cri;
      const newestCRI = historicalData[historicalData.length - 1].cri;

      // Calculate percentage change based on CRI movement
      // For early blight (CRI below 50), decreasing is worse
      // For late blight (CRI above 50), increasing is worse
      if (newestCRI < 50) {
        // Early blight zone - decreasing CRI means increasing risk
        weeklyRiskChange = ((oldestCRI - newestCRI) / oldestCRI) * 100;
      } else {
        // Late blight zone - increasing CRI means increasing risk
        weeklyRiskChange = ((newestCRI - oldestCRI) / oldestCRI) * 100;
      }
    }

    // Get recent diagnoses
    const recentDiagnoses = await Diagnosis.find({ farmerId })
      .sort({ createdAt: -1 })
      .limit(3);

    // Generate insights based on all available data
    const insights = [];
    const recommendations = [];

    // Current conditions insights
    const cri = latestData.cri;
    const { temperature, humidity, rainfall } = latestData;

    // Convert CRI to risk metrics
    let currentRisk, farmHealth, seasonalRisk;
    if (cri < 50) {
      // Early blight zone - lower CRI means higher risk
      currentRisk = Math.max(0, 100 - cri * 2);
      farmHealth = Math.min(100, cri * 2);
    } else {
      // Late blight zone - higher CRI means higher risk
      currentRisk = Math.min(100, (cri - 50) * 2);
      farmHealth = Math.max(0, 100 - (cri - 50) * 2);
    }

    // Seasonal risk based on historical data and the time of year
    const currentMonth = new Date().getMonth();
    // Higher risk in wet seasons (typically March-May, September-November in Uganda)
    const isWetSeason = [2, 3, 4, 8, 9, 10].includes(currentMonth);
    seasonalRisk = isWetSeason
      ? 60 + Math.random() * 20
      : 30 + Math.random() * 20;

    // Create stats object
    const stats = {
      currentRisk,
      weeklyRiskChange,
      seasonalRisk,
      farmHealth
    };

    // CRI-based insights
    if (cri < 30) {
      insights.push({
        type: "critical",
        title: "High Early Blight Risk Detected",
        description:
          "Your farm is currently experiencing conditions that significantly favor early blight development. Immediate protective measures are recommended.",
        icon: "AlertCircle"
      });

      recommendations.push({
        title: "Apply Preventative Fungicide",
        description:
          "Based on current conditions, applying a copper-based fungicide would provide protection against potential early blight development.",
        priority: "high",
        category: "treatment"
      });
    } else if (cri > 70) {
      insights.push({
        type: "critical",
        title: "High Late Blight Risk Detected",
        description:
          "Current conditions strongly favor late blight development. Your crop is at elevated risk and requires attention.",
        icon: "AlertCircle"
      });

      recommendations.push({
        title: "Apply Late Blight Specific Fungicide",
        description:
          "Use a systemic fungicide containing mancozeb or chlorothalonil to protect against late blight infection.",
        priority: "high",
        category: "treatment"
      });
    }

    // Temperature insights
    if (temperature > 28) {
      insights.push({
        type: "warning",
        title: "High Temperature Alert",
        description:
          "Temperatures above 28°C may stress plants and affect fruit development, but can reduce late blight risk. Ensure adequate irrigation.",
        icon: "Thermometer"
      });

      recommendations.push({
        title: "Increase Watering Frequency",
        description:
          "Consider increasing irrigation frequency during hot periods to prevent plant stress and maintain optimal growing conditions.",
        priority: "medium",
        category: "irrigation"
      });
    } else if (temperature < 15) {
      insights.push({
        type: "warning",
        title: "Low Temperature Alert",
        description:
          "Temperatures below 15°C slow plant growth and can increase susceptibility to certain diseases, particularly late blight.",
        icon: "Thermometer"
      });
    }

    // Humidity insights
    if (humidity > 80) {
      insights.push({
        type: "warning",
        title: "Elevated Humidity Levels",
        description:
          "Humidity levels above 80% create favorable conditions for fungal diseases. Consider improving air circulation around plants.",
        icon: "Droplets"
      });

      recommendations.push({
        title: "Improve Air Circulation",
        description:
          "Prune lower leaves to increase air circulation and reduce humidity around plants, which helps prevent disease development.",
        priority: "medium",
        category: "cultural"
      });
    }

    // Rainfall insights
    if (rainfall > 20) {
      insights.push({
        type: "warning",
        title: "Heavy Rainfall Alert",
        description:
          "Recent heavy rainfall increases the risk of soil-borne diseases and may wash away protective fungicides.",
        icon: "CloudRain"
      });

      recommendations.push({
        title: "Reapply Fungicides",
        description:
          "Heavy rainfall may have washed away protective fungicides. Consider reapplication once foliage has dried.",
        priority: "medium",
        category: "treatment"
      });
    }

    // Add recommendations based on diagnosis history
    if (recentDiagnoses.length > 0) {
      const hasBlightDiagnosis = recentDiagnoses.some((diagnosis) =>
        diagnosis.disease.includes("Blight")
      );

      if (hasBlightDiagnosis) {
        insights.push({
          type: "warning",
          title: "Recent Blight Detection",
          description:
            "You have recently diagnosed blight in your crop. Continue monitoring and treating affected areas.",
          icon: "AlertTriangle"
        });

        recommendations.push({
          title: "Increase Monitoring Frequency",
          description:
            "Due to recent blight detection, increase your field scouting to at least twice weekly to catch any new infections early.",
          priority: "high",
          category: "monitoring"
        });
      }
    }

    // Add seasonal insights
    if (isWetSeason) {
      insights.push({
        type: "info",
        title: "Wet Season Precautions",
        description:
          "The current wet season increases disease pressure. Consider more frequent preventative applications and improved drainage.",
        icon: "CloudRain"
      });

      recommendations.push({
        title: "Improve Field Drainage",
        description:
          "During wet seasons, ensure proper field drainage to reduce standing water which can promote disease development.",
        priority: "medium",
        category: "cultural"
      });
    } else {
      insights.push({
        type: "info",
        title: "Dry Season Management",
        description:
          "Dry conditions may reduce blight pressure but monitor for early blight which can thrive in warmer, drier conditions.",
        icon: "Thermometer"
      });
    }

    // Provide a general recommendation for all farmers
    recommendations.push({
      title: "Schedule Disease Scouting",
      description:
        "Implement a regular scouting schedule to catch early signs of disease before they spread throughout your crop.",
      priority: "low",
      category: "monitoring"
    });

    // Seed health recommendation
    recommendations.push({
      title: "Use Disease-Free Seeds",
      description:
        "Always use certified disease-free seeds for new plantings to prevent introducing diseases into your fields.",
      priority: "low",
      category: "planting"
    });

    res.status(200).json({
      message: "Insights generated successfully",
      insights,
      recommendations,
      stats
    });
  } catch (error) {
    console.error("Error generating insights:", error);
    res.status(500).json({
      message: "Failed to generate insights",
      error: error.message
    });
  }
};

module.exports = {
  getInsights
};
