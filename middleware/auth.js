// middleware/auth.js
const jwt = require("jsonwebtoken");
// Import using try-catch to prevent OverwriteModelError
const mongoose = require("mongoose");
let Farmer;
try {
  Farmer = mongoose.model("Farmer");
} catch (error) {
  Farmer = require("../models/Farmer");
}

/**
 * Generate access and refresh tokens
 * @param {Object} user - User object
 * @param {Boolean} rememberMe - Whether to extend token lifetime
 * @returns {Object} - Object containing access and refresh tokens
 */
const generateTokens = (user, rememberMe = false) => {
  const accessToken = jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: "1h" } // Extended from 15 minutes to 1 hour
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: rememberMe ? "30d" : "7d" } // Extended to 30 days if rememberMe is true
  );

  return { accessToken, refreshToken };
};

/**
 * Authenticate using JWT access token with auto-refresh capability
 */
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!token) {
    // Try to use refresh token if access token is not provided
    if (refreshToken) {
      try {
        return await refreshAndContinue(refreshToken, req, res, next);
      } catch (error) {
        return res.status(401).json({
          message: "Access denied. Please log in again.",
          needsReauthentication: true
        });
      }
    }
    return res
      .status(401)
      .json({ message: "Access denied. No token provided." });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
    if (err) {
      // Handle token expiration by attempting to use refresh token
      if (err.name === "TokenExpiredError" && refreshToken) {
        try {
          return await refreshAndContinue(refreshToken, req, res, next);
        } catch (refreshError) {
          return res.status(403).json({
            message: "Session expired. Please log in again.",
            needsReauthentication: true
          });
        }
      }
      return res.status(403).json({ message: "Invalid or expired token." });
    }
    req.user = user;

    // Implement sliding sessions - if token is close to expiry (less than 15 minutes)
    const tokenData = jwt.decode(token);
    const timeToExpiry = tokenData.exp - Math.floor(Date.now() / 1000);

    // Only attempt silent refresh if time is under threshold and we have a refresh token
    if (timeToExpiry < 15 * 60 && refreshToken) {
      try {
        const { accessToken, refreshToken: newRefreshToken } =
          await refreshUserTokens(refreshToken);

        // Set the new tokens in the response
        res.cookie("refreshToken", newRefreshToken, {
          httpOnly: true,
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict"
        });

        // Add the new access token to the response headers
        res.setHeader("X-New-Access-Token", accessToken);
      } catch (error) {
        // Don't break the flow on silent refresh failure, but log it properly
        console.log(`Token refresh attempted but failed: ${error.message}`);
        // Continue with the existing valid token
      }
    }

    next();
  });
};

/**
 * Refresh tokens and continue the request
 */
const refreshAndContinue = async (refreshToken, req, res, next) => {
  const {
    accessToken,
    refreshToken: newRefreshToken,
    farmer
  } = await refreshUserTokens(refreshToken);

  // Set the new tokens in the response
  res.cookie("refreshToken", newRefreshToken, {
    httpOnly: true,
    maxAge: farmer.rememberMe
      ? 30 * 24 * 60 * 60 * 1000
      : 7 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict"
  });

  // Add the new access token to the response headers
  res.setHeader("X-New-Access-Token", accessToken);

  // Update the request with the user info and continue
  req.user = { id: farmer._id };
  next();
};

/**
 * Refresh user tokens with security measures
 */
const refreshUserTokens = async (refreshToken) => {
  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    // Get farmer from database - first check with the token
    let farmer = await Farmer.findOne({
      _id: decoded.id,
      refreshToken: refreshToken
    });

    // If not found with exact match, try just by ID as fallback
    // This helps with token rotation or database inconsistency issues
    if (!farmer) {
      farmer = await Farmer.findById(decoded.id);

      // Log that we had to use the fallback approach
      console.log(
        `Refresh token not matched for user ${decoded.id}, proceeding with ID only`
      );

      // Update the refreshToken in the database to avoid future mismatches
      if (farmer) {
        farmer.refreshToken = undefined; // Clear any old token
      }
    }

    if (!farmer) {
      throw new Error("Invalid refresh token or user not found");
    }

    // Generate new tokens with token rotation for security
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      farmer,
      farmer.rememberMe
    );

    // Store the new refresh token and invalidate the old one
    farmer.refreshToken = newRefreshToken;
    await farmer.save();

    return { accessToken, refreshToken: newRefreshToken, farmer };
  } catch (error) {
    // Add more detailed error logging
    if (error.name === "TokenExpiredError") {
      console.log("Refresh token has expired");
    } else if (error.name === "JsonWebTokenError") {
      console.log("Invalid refresh token format");
    }

    throw error; // Re-throw the error to be handled by the caller
  }
};

/**
 * Verify email is verified before continuing
 */
const verifyEmail = async (req, res, next) => {
  try {
    const farmer = await Farmer.findById(req.user.id);

    if (!farmer) {
      return res.status(404).json({ message: "Farmer not found." });
    }

    if (!farmer.isVerified) {
      return res.status(403).json({
        message: "Email not verified. Please verify your email first.",
        needsVerification: true,
        email: farmer.email
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: "Server error verifying email status." });
  }
};

module.exports = {
  generateTokens,
  authenticateToken,
  verifyEmail,
  refreshUserTokens
};
