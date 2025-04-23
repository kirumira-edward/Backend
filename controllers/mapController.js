const Farmer = require("../models/Farmer");
const EnvironmentalData = require("../models/EnvironmentalData");

/**
 * Get all farm locations with their latest environmental data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getFarmLocations = async (req, res) => {
  try {
    // Find all verified farmers
    const farmers = await Farmer.find({ isVerified: true })
      .select(
        "_id firstName lastName defaultLocation region district locationName"
      )
      .lean();

    // Extract farmer IDs
    const farmerIds = farmers.map((farmer) => farmer._id);

    // Find the latest environmental data for each farmer
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get the most recent environmental data for each farmer
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
          blightType: 1,
          date: 1,
          coordinates: 1
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
        soilMoisture: data.soilMoisture,
        cri: data.cri,
        riskLevel: data.riskLevel,
        blightType: data.blightType,
        date: data.date,
        coordinates: data.coordinates
      };
    });

    // Create location objects with farmer and environmental data
    const locations = farmers.map((farmer) => {
      const farmerId = farmer._id.toString();
      const environmentalData = farmerDataMap[farmerId] || {
        temperature: 0,
        humidity: 0,
        rainfall: 0,
        soilMoisture: 0,
        cri: 50,
        riskLevel: "Low",
        blightType: "Healthy",
        date: new Date()
      };

      return {
        id: farmerId,
        farmer: {
          firstName: farmer.firstName,
          lastName: farmer.lastName
        },
        location: {
          latitude: farmer.defaultLocation?.latitude || 0,
          longitude: farmer.defaultLocation?.longitude || 0,
          district: farmer.district || "Unknown",
          name: farmer.locationName || farmer.district || "Unknown Location"
        },
        environmentalData: environmentalData
      };
    });

    // Only include farmers with valid locations
    const validLocations = locations.filter(
      (loc) => loc.location.latitude && loc.location.longitude
    );

    res.status(200).json({
      locations: validLocations,
      totalCount: validLocations.length
    });
  } catch (error) {
    console.error("Error fetching farm locations:", error);
    res
      .status(500)
      .json({
        message: "Failed to fetch farm locations",
        error: error.message
      });
  }
};

module.exports = {
  getFarmLocations
};
