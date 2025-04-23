const express = require("express");
const router = express.Router();
const { authenticateToken, verifyEmail } = require("../middleware/auth");
const mongoose = require("mongoose");

// Import models using try-catch to prevent OverwriteModelError
let EnvironmentalData, Diagnosis;
try {
  EnvironmentalData = mongoose.model("EnvironmentalData");
  Diagnosis = mongoose.model("Diagnosis");
} catch (error) {
  EnvironmentalData = require("../models/EnvironmentalData");
  Diagnosis = mongoose.model("Diagnosis");
}

// Get analytics insights
router.get("/insights", authenticateToken, verifyEmail, async (req, res) => {
  try {
    const farmerId = req.user.id;

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

    // Generate insights
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

    // Seasonal risk based on time of year
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

    // Generate sample insights based on conditions
    if (cri < 30) {
      insights.push({
        type: "critical",
        title: "High Early Blight Risk Detected",
        description:
          "Your farm is currently experiencing conditions that significantly favor early blight development.",
        icon: "AlertCircle"
      });

      recommendations.push({
        title: "Apply Preventative Fungicide",
        description:
          "Based on current conditions, applying a copper-based fungicide would provide protection.",
        priority: "high",
        category: "treatment"
      });
    } else if (cri > 70) {
      insights.push({
        type: "critical",
        title: "High Late Blight Risk Detected",
        description:
          "Current conditions strongly favor late blight development. Your crop is at elevated risk.",
        icon: "AlertCircle"
      });
    }

    // Add general recommendations
    recommendations.push({
      title: "Schedule Disease Scouting",
      description:
        "Implement a regular scouting schedule to catch early signs of disease.",
      priority: "medium",
      category: "monitoring"
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
});

module.exports = router;
