const express = require("express");
const router = express.Router();
const { authenticateToken, verifyEmail } = require("../middleware/auth");
const Farmer = require("../models/Farmer");
const EnvironmentalData = require("../models/EnvironmentalData");

// Get the authenticated farmer's location
router.get("/my-location", authenticateToken, async (req, res) => {
  try {
    const farmer = await Farmer.findById(req.user.id);

    if (!farmer) {
      return res.status(404).json({ message: "Farmer not found" });
    }

    // Check if farmer has a location set
    if (
      !farmer.defaultLocation ||
      !farmer.defaultLocation.latitude ||
      !farmer.defaultLocation.longitude
    ) {
      return res.status(404).json({
        message: "Farm location not set",
        needsLocationUpdate: true
      });
    }

    // Get the most recent environmental data for this farmer
    const recentData = await EnvironmentalData.findOne({ farmerId: farmer._id })
      .sort({ date: -1 })
      .limit(1);

    res.status(200).json({
      location: {
        latitude: farmer.defaultLocation.latitude,
        longitude: farmer.defaultLocation.longitude,
        district: farmer.district || "Unknown",
        name: farmer.farmName || "My Farm"
      },
      environmentalData: recentData
        ? {
            cri: recentData.cri,
            riskLevel: recentData.riskLevel,
            blightType: recentData.blightType || "Unknown",
            temperature: recentData.temperature,
            humidity: recentData.humidity,
            rainfall: recentData.rainfall,
            soilMoisture: recentData.soilMoisture || 0
          }
        : null
    });
  } catch (error) {
    console.error("Error fetching farmer location:", error);
    res.status(500).json({
      message: "Failed to fetch location",
      error: error.message
    });
  }
});

// Get farm locations for the map (with special handling for self)
router.get("/farm-locations", authenticateToken, async (req, res) => {
  try {
    const { self = true, nearby = true, limit = 20 } = req.query;
    const locations = [];

    // Always include the current farmer's location if self=true
    if (self === true || self === "true") {
      const currentFarmer = await Farmer.findById(req.user.id);

      if (
        currentFarmer &&
        currentFarmer.defaultLocation &&
        currentFarmer.defaultLocation.latitude &&
        currentFarmer.defaultLocation.longitude
      ) {
        // Get most recent environmental data
        const recentData = await EnvironmentalData.findOne({
          farmerId: currentFarmer._id
        })
          .sort({ date: -1 })
          .limit(1);

        locations.push({
          id: currentFarmer._id,
          isSelf: true,
          farmer: {
            firstName: currentFarmer.firstName,
            lastName: currentFarmer.lastName
          },
          location: {
            latitude: currentFarmer.defaultLocation.latitude,
            longitude: currentFarmer.defaultLocation.longitude,
            district: currentFarmer.district || "Unknown",
            name: currentFarmer.farmName || "My Farm"
          },
          environmentalData: recentData
            ? {
                cri: recentData.cri,
                riskLevel: recentData.riskLevel,
                blightType: recentData.blightType || "Unknown",
                temperature: recentData.temperature,
                humidity: recentData.humidity,
                rainfall: recentData.rainfall,
                soilMoisture: recentData.soilMoisture || 0
              }
            : {
                cri: 50,
                riskLevel: "Low",
                blightType: "Healthy",
                temperature: 25,
                humidity: 60,
                rainfall: 0,
                soilMoisture: 40
              }
        });
      }
    }

    // Add nearby farmers if requested
    if (nearby === true || nearby === "true") {
      // Implementation to find nearby farmers based on coordinates
      // This is a placeholder - a real implementation would use geospatial queries
      const otherFarmers = await Farmer.find({
        _id: { $ne: req.user.id },
        "defaultLocation.latitude": { $exists: true },
        "defaultLocation.longitude": { $exists: true }
      }).limit(parseInt(limit) - locations.length);

      for (const farmer of otherFarmers) {
        const recentData = await EnvironmentalData.findOne({
          farmerId: farmer._id
        })
          .sort({ date: -1 })
          .limit(1);

        locations.push({
          id: farmer._id,
          isSelf: false,
          farmer: {
            firstName: farmer.firstName,
            lastName: farmer.lastName
          },
          location: {
            latitude: farmer.defaultLocation.latitude,
            longitude: farmer.defaultLocation.longitude,
            district: farmer.district || "Unknown",
            name: farmer.farmName || "Other Farm"
          },
          environmentalData: recentData
            ? {
                cri: recentData.cri,
                riskLevel: recentData.riskLevel,
                blightType: recentData.blightType || "Unknown",
                temperature: recentData.temperature,
                humidity: recentData.humidity,
                rainfall: recentData.rainfall,
                soilMoisture: recentData.soilMoisture || 0
              }
            : null
        });
      }
    }

    res.status(200).json({ locations });
  } catch (error) {
    console.error("Error fetching farm locations:", error);
    res.status(500).json({
      message: "Failed to fetch farm locations",
      error: error.message
    });
  }
});

// Add a public endpoint for farm locations that doesn't require authentication
router.get("/public-farm-locations", async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    // Find all verified farmers with location data (exclude sensitive information)
    const farmers = await Farmer.find({
      isVerified: true,
      "defaultLocation.latitude": { $exists: true },
      "defaultLocation.longitude": { $exists: true }
    })
      .select("_id firstName lastName defaultLocation district farmName")
      .limit(parseInt(limit))
      .lean();

    // Extract farmer IDs
    const farmerIds = farmers.map((farmer) => farmer._id);

    // Find the latest environmental data for each farmer
    const latestDataByFarmer = await EnvironmentalData.aggregate([
      {
        $match: {
          farmerId: { $in: farmerIds }
        }
      },
      {
        $sort: { date: -1 }
      },
      {
        $group: {
          _id: "$farmerId",
          doc: { $first: "$$ROOT" }
        }
      },
      {
        $replaceRoot: { newRoot: "$doc" }
      },
      {
        $project: {
          _id: 1,
          farmerId: 1,
          temperature: 1,
          humidity: 1,
          rainfall: 1,
          soilMoisture: 1,
          cri: 1,
          riskLevel: 1,
          blightType: 1
        }
      }
    ]);

    // Create a map of farmerId to its latest environmental data
    const farmerDataMap = {};
    latestDataByFarmer.forEach((data) => {
      farmerDataMap[data.farmerId.toString()] = {
        temperature: data.temperature,
        humidity: data.humidity,
        rainfall: data.rainfall,
        soilMoisture: data.soilMoisture || 0,
        cri: data.cri,
        riskLevel: data.riskLevel,
        blightType: data.blightType || "Unknown"
      };
    });

    // Create location objects with farmer and environmental data
    const locations = farmers.map((farmer) => {
      const farmerId = farmer._id.toString();
      const environmentalData = farmerDataMap[farmerId] || {
        temperature: 25,
        humidity: 60,
        rainfall: 0,
        soilMoisture: 40,
        cri: 50,
        riskLevel: "Low",
        blightType: "Healthy"
      };

      return {
        id: farmerId,
        farmer: {
          firstName: farmer.firstName,
          lastName: farmer.lastName
        },
        location: {
          latitude: farmer.defaultLocation.latitude,
          longitude: farmer.defaultLocation.longitude,
          district: farmer.district || "Unknown",
          name: farmer.farmName || farmer.district || "Farm"
        },
        environmentalData: environmentalData
      };
    });

    res.status(200).json({
      locations,
      totalCount: locations.length
    });
  } catch (error) {
    console.error("Error fetching public farm locations:", error);
    res.status(500).json({
      message: "Failed to fetch farm locations",
      error: error.message
    });
  }
});

module.exports = router;
