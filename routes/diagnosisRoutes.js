const express = require("express");
const router = express.Router();
const {
  validatePlantImage,
  diagnosePlant, 
  getDiagnosisHistory,
  getDiagnosisById
} = require("../controllers/diagnosisController");
const { authenticateToken, verifyEmail } = require("../middleware/auth");

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(verifyEmail);

// Validate image before diagnosis
router.post("/validate", validatePlantImage);

// Diagnose a pre-validated image
router.post("/diagnose", diagnosePlant);

// Get diagnosis history
router.get("/history", getDiagnosisHistory);

// Get specific diagnosis by ID
router.get("/:id", getDiagnosisById);

module.exports = router;