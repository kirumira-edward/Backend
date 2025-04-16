// controllers/userController.js
const Farmer = require("../models/Farmer");
const Notification = require("../models/Notification");
const mongoose = require("mongoose");
const { sendPasswordResetEmail } = require("../utils/emailService");

// Change password
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Validate request
  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ message: "Current password and new password are required." });
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
      return res
        .status(400)
        .json({ message: "Current password is incorrect." });
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
    return res
      .status(400)
      .json({ message: "Password is required to delete account." });
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
    if (mongoose.modelNames().includes("EnvironmentalData")) {
      const EnvironmentalData = mongoose.model("EnvironmentalData");
      await EnvironmentalData.deleteMany({ farmerId: farmer._id });
    }

    // Delete any diagnoses
    if (mongoose.modelNames().includes("Diagnosis")) {
      const Diagnosis = mongoose.model("Diagnosis");
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
    ).select(
      "-password -refreshToken -verificationCode -verificationCodeExpires"
    );

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

// Forgot password - request reset
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  try {
    const farmer = await Farmer.findOne({ email });

    // Don't reveal whether a user exists for security reasons
    if (!farmer) {
      return res.status(200).json({
        message:
          "If your email is registered, you will receive password reset instructions."
      });
    }

    // Generate reset token
    const resetCode = farmer.generateResetPasswordToken();
    await farmer.save();

    // Send reset email
    await sendPasswordResetEmail(email, farmer.firstName, resetCode);

    res.status(200).json({
      message:
        "If your email is registered, you will receive password reset instructions."
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Error processing your request." });
  }
};

// Verify reset token
const verifyResetToken = async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res
      .status(400)
      .json({ message: "Email and reset code are required." });
  }

  try {
    const farmer = await Farmer.findOne({
      email,
      resetPasswordToken: code,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!farmer) {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset code." });
    }

    res.status(200).json({ message: "Reset code is valid." });
  } catch (err) {
    console.error("Verify reset token error:", err);
    res.status(500).json({ message: "Error verifying reset code." });
  }
};

// Reset password with token
const resetPassword = async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({
      message: "Email, reset code, and new password are required."
    });
  }

  try {
    const farmer = await Farmer.findOne({
      email,
      resetPasswordToken: code,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!farmer) {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset code." });
    }

    // Set new password
    farmer.password = newPassword;

    // Clear reset token
    farmer.resetPasswordToken = undefined;
    farmer.resetPasswordExpires = undefined;

    await farmer.save();

    res.status(200).json({ message: "Password has been reset successfully." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Error resetting password." });
  }
};

module.exports = {
  changePassword,
  deleteAccount,
  updateProfile,
  forgotPassword,
  verifyResetToken,
  resetPassword
};
