const Farmer = require("../models/Farmer");
const { generateTokens } = require("../middleware/auth");
const { sendVerificationEmail } = require("../utils/emailService");

/**
 * Login user and generate tokens
 */
exports.login = async (req, res) => {
  const { email, password, rememberMe = false } = req.body;

  try {
    const farmer = await Farmer.findOne({ email });
    if (!farmer) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    const isMatch = await farmer.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    // Check if email is verified
    if (!farmer.isVerified) {
      return res.status(403).json({
        message: "Email not verified. Please verify your email first.",
        needsVerification: true,
        email: farmer.email
      });
    }

    // Update the remember me preference
    farmer.rememberMe = rememberMe;

    // Update last active timestamp
    farmer.lastActive = new Date();

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(farmer, rememberMe);

    // Save refresh token to database - make sure we clear out any old tokens first
    farmer.refreshToken = refreshToken;
    await farmer.save();

    // Set refresh token as HTTP-only cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000, // 7 days or 30 days
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict"
    });

    res.json({
      accessToken,
      user: {
        id: farmer._id,
        firstName: farmer.firstName,
        lastName: farmer.lastName,
        email: farmer.email,
        profilePhoto: farmer.profilePhoto
      },
      message: "Login successful."
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Error logging in farmer." });
  }
};

/**
 * Refresh tokens for user
 */
exports.refreshToken = async (req, res) => {
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh token not provided." });
  }

  try {
    const { refreshUserTokens } = require("../middleware/auth");

    const {
      accessToken,
      refreshToken: newRefreshToken,
      farmer
    } = await refreshUserTokens(refreshToken);

    // Set new refresh token as HTTP-only cookie
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      maxAge: farmer.rememberMe
        ? 30 * 24 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict"
    });

    res.json({
      accessToken,
      user: {
        id: farmer._id,
        firstName: farmer.firstName,
        lastName: farmer.lastName,
        email: farmer.email,
        profilePhoto: farmer.profilePhoto,
        lastActive: farmer.lastActive
      }
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(403).json({
      message: "Invalid refresh token.",
      needsReauthentication: true
    });
  }
};

/**
 * Logout user
 */
exports.logout = async (req, res) => {
  try {
    // Clear refresh token in database
    const farmer = await Farmer.findById(req.user.id);
    if (farmer) {
      farmer.refreshToken = undefined;
      await farmer.save();
    }

    // Clear refresh token cookie
    res.clearCookie("refreshToken");

    res.json({ message: "Logged out successfully." });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Error logging out." });
  }
};
