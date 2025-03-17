// middleware/auth.js
const jwt = require("jsonwebtoken");
const Farmer = require("../models/Farmer");

/**
 * Generate access and refresh tokens
 * @param {Object} user - User object
 * @returns {Object} - Object containing access and refresh tokens
 */
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: "15m" } // Short-lived token
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" } // Longer-lived token
  );

  return { accessToken, refreshToken };
};

/**
 * Authenticate using JWT access token
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ message: "Access denied. No token provided." });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token." });
    }
    req.user = user;
    next();
  });
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
        needsVerification: true
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
  verifyEmail
};
