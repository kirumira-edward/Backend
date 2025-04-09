// controllers/userController.js
const Farmer = require("../models/Farmer");
const Notification = require("../models/Notification");
const mongoose = require("mongoose");

// Change password
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  // Validate request
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Current password and new password are required." });
  }
  
  try {
    // Find farmer by ID
    const farmer = await Farmer.findById(req.user.id);
    if (!farmer) {
      return res.status(404).json({ message: "Farmer not found." });
    }
    
    // Verify current password
    const isMatch = await farmer.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect." });
    }
    
    // Set new password (the pre-save hook in your Farmer model will hash it)
    farmer.password = newPassword;
    await farmer.save();
    
    res.json({ message: "Password changed successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error changing password." });
  }
};

// Delete account
const deleteAccount = async (req, res) => {
  const { password } = req.body;
  
  // Validate request
  if (!password) {
    return res.status(400).json({ message: "Password is required to delete account." });
  }
  
  try {
    // Find farmer by ID
    const farmer = await Farmer.findById(req.user.id);
    if (!farmer) {
      return res.status(404).json({ message: "Farmer not found." });
    }
    
    // Verify password
    const isMatch = await farmer.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Password is incorrect." });
    }
    
    // Delete related data
    await Notification.deleteMany({ farmerId: farmer._id });
    
    // Delete any environmental data
    if (mongoose.modelNames().includes('EnvironmentalData')) {
      const EnvironmentalData = mongoose.model('EnvironmentalData');
      await EnvironmentalData.deleteMany({ farmerId: farmer._id });
    }
    
    // Delete any diagnoses
    if (mongoose.modelNames().includes('Diagnosis')) {
      const Diagnosis = mongoose.model('Diagnosis');
      await Diagnosis.deleteMany({ farmerId: farmer._id });
    }
    
    // Finally delete the farmer
    await Farmer.findByIdAndDelete(farmer._id);
    
    // Clear cookie
    res.clearCookie("refreshToken");
    
    res.json({ message: "Account deleted successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting account." });
  }
};

// Update profile (optional functionality)
const updateProfile = async (req, res) => {
  const { firstName, lastName, defaultLocation } = req.body;
  
  try {
    const updatedFarmer = await Farmer.findByIdAndUpdate(
      req.user.id,
      { 
        $set: { 
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          defaultLocation: defaultLocation || undefined
        } 
      },
      { new: true, runValidators: true }
    ).select('-password -refreshToken -verificationCode -verificationCodeExpires');
    
    if (!updatedFarmer) {
      return res.status(404).json({ message: "Farmer not found." });
    }
    
    res.json({
      message: "Profile updated successfully.",
      user: updatedFarmer
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating profile." });
  }
};

module.exports = {
  changePassword,
  deleteAccount,
  updateProfile
};