const Farmer = require("../models/Farmer");
const FarmLocation = require("../models/FarmLocation");

/**
 * Update farm location
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateLocation = async (req, res) => {
  try {
    const { latitude, longitude, name, district } = req.body;

    // Validate inputs
    if (!latitude || !longitude) {
      return res
        .status(400)
        .json({ message: "Latitude and longitude are required" });
    }

    if (!name) {
      return res.status(400).json({ message: "Location name is required" });
    }

    // Update the farmer's location
    const farmer = await Farmer.findById(req.user.id);

    if (!farmer) {
      return res.status(404).json({ message: "Farmer not found" });
    }

    farmer.defaultLocation = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      name,
      district: district || ""
    };

    await farmer.save();

    // Update existing map location or create a new one
    let farmLocation = await FarmLocation.findOne({ farmerId: req.user.id });

    if (farmLocation) {
      farmLocation.location = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        name,
        district: district || ""
      };
    } else {
      farmLocation = new FarmLocation({
        farmerId: req.user.id,
        location: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          name,
          district: district || ""
        },
        // Default environmental data
        environmentalData: {
          cri: 50,
          riskLevel: "Low",
          blightType: "Healthy",
          temperature: 25,
          humidity: 60,
          rainfall: 0,
          soilMoisture: 50
        }
      });
    }

    await farmLocation.save();

    res.status(200).json({
      message: "Farm location updated successfully",
      location: farmer.defaultLocation
    });
  } catch (error) {
    console.error("Error updating location:", error);
    res.status(500).json({ message: "Failed to update farm location" });
  }
};

/**
 * Get farm location
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getLocation = async (req, res) => {
  try {
    const farmer = await Farmer.findById(req.user.id);

    if (!farmer) {
      return res.status(404).json({ message: "Farmer not found" });
    }

    // If location exists, return it
    if (
      farmer.defaultLocation &&
      farmer.defaultLocation.latitude &&
      farmer.defaultLocation.longitude
    ) {
      return res.status(200).json({
        message: "Farm location retrieved successfully",
        location: farmer.defaultLocation
      });
    }

    // Try to find location in FarmLocation collection if not in farmer
    const farmLocation = await FarmLocation.findOne({ farmerId: req.user.id });

    if (farmLocation && farmLocation.location) {
      // Update the farmer record with the location from FarmLocation
      farmer.defaultLocation = farmLocation.location;
      await farmer.save();

      return res.status(200).json({
        message: "Farm location retrieved successfully",
        location: farmLocation.location
      });
    }

    // No location found
    return res.status(404).json({
      message: "No farm location found",
      location: null
    });
  } catch (error) {
    console.error("Error retrieving location:", error);
    res.status(500).json({ message: "Failed to retrieve farm location" });
  }
};

module.exports = {
  updateLocation,
  getLocation
};
