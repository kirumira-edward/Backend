// utils/geminiService.js
const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();

// Constants for API calls
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL_ID = "gemini-2.0-flash"; // Using flash model for both validation and diagnosis

// API URLs
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_ID}:generateContent`;

/**
 * Validates if an image is a proper tomato plant image using Gemini
 * @param {string} base64Image - Base64 encoded image data
 * @returns {Promise<Object>} Validation result with isValid flag and message
 */
const validateImage = async (base64Image) => {
  try {
    const url = `${GEMINI_URL}?key=${GEMINI_API_KEY}`;

    const prompt = `
      Analyze this image and determine if it meets these criteria:
      1. The image must show a tomato plant leaf, leaves, stem or fruit.
      2. The image must be clear enough to identify plant features.
      3. The image should be well-lit.

      If the image meets ALL criteria, respond with EXACTLY: {"is_valid": true}

      If the image fails ANY criteria, respond with a JSON object like this:
      {"is_valid": false, "message": "Brief explanation of why the image is invalid and what kind of image should be uploaded instead"}

      Your response must be valid JSON only. No other text.
    `;

    const payload = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: { mime_type: "image/jpeg", data: base64Image }
            }
          ]
        }
      ]
    };

    const headers = {
      "Content-Type": "application/json"
    };

    const response = await axios.post(url, payload, { headers });

    // Extract the validation result from text
    const validationText =
      response.data.candidates[0]?.content?.parts[0]?.text || "";

    // Extract JSON from the response text
    const validation = extractJsonFromText(validationText);

    if (validation && "is_valid" in validation) {
      return validation;
    } else {
      return {
        is_valid: false,
        message:
          "Unable to validate image. Please ensure you're uploading a clear, well-lit image of a tomato plant leaf."
      };
    }
  } catch (error) {
    console.error("Error validating image with Gemini:", error);
    return {
      is_valid: false,
      message:
        "Error during validation. Please try again with a clear image of a tomato plant leaf."
    };
  }
};

/**
 * Diagnoses tomato disease using the base Gemini model (flash version)
 * @param {string} base64Image - Base64 encoded image data
 * @param {number} cri - Cumulative Risk Index value
 * @returns {Promise<Object>} Diagnosis result with condition, confidence, and recommendation
 */
const diagnoseTomatoDisease = async (base64Image, cri) => {
  try {
    const url = `${GEMINI_URL}?key=${GEMINI_API_KEY}`;

    const prompt = `
      Analyze the following image which may contain a **full tomato plant, a single leaf, the stem, or the fruit**, for signs of disease.
      Based on the visual information, identify the most likely disease from the following options:
      "Healthy", "Early Blight", "Late Blight", or "Unknown".

      Consider these visual cues:
      - **Healthy:** Look for uniformly green leaves and stem, no significant spots or discoloration. Fruit should be typical for its stage.
      - **Early Blight:** Look for **dark spots on the leaves**, especially older ones. These spots often have a characteristic **"target pattern" of concentric rings**. There might be **yellowing of the leaf tissue around the spots**. Stem lesions are less common but can occur. Fruit can develop dark, sunken spots near the stem.
      - **Late Blight:** Look for **irregular, water-soaked spots on the leaves** that quickly turn brown or black. In humid conditions, you might see **white, fuzzy mold, particularly on the undersides of the leaves**. Stem lesions are usually firm and brown. Green or ripe fruit can develop large, firm, brown, or black lesions.

      Consider the Cumulative Risk Index (CRI) of ${cri}. A CRI below 50 suggests a higher likelihood of Early Blight, while a CRI above 50 suggests a higher likelihood of Late Blight. Use this as additional context.
  
  Provide:
  - Brief description of observed symptoms (2-3 sentences maximum)
  - Confidence percentage (0-100)
  - 5-7 specific, actionable recommendations for Uganda farmers
  - Include at least 2 locally relevant resources (links to websites for acquiring more information or assistance) relevant to the identified condition, platforms where they can purchase the required treatment for the conditon. Ensure they are accessible to Ugandan farmers.)
  
  Format as JSON with these keys:
  "condition", "confidence", "symptoms", "recommendations", "resources"
  
  Keep responses brief and direct. JSON only, no additional text.
    `;

    const payload = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: { mime_type: "image/jpeg", data: base64Image }
            }
          ]
        }
      ]
    };

    const headers = {
      "Content-Type": "application/json"
    };

    const response = await axios.post(url, payload, { headers });

    const responseText =
      response.data.candidates[0]?.content?.parts[0]?.text || "";

    const diagnosis = extractDiagnosisInfo(responseText);

    if (
      diagnosis &&
      diagnosis.condition &&
      diagnosis.confidence &&
      diagnosis.recommendation &&
      diagnosis.signs_and_symptoms
    ) {
      return {
        condition: diagnosis.condition,
        confidence: parseFloat(diagnosis.confidence),
        recommendation: diagnosis.recommendation,
        signs_and_symptoms: diagnosis.signs_and_symptoms
      };
    } else {
      console.warn(
        "Failed to extract all diagnosis information from Gemini response:",
        responseText
      );
      return {
        condition: "Unknown",
        confidence: 0,
        recommendation:
          "Unable to get a diagnosis from the image. Please try again with a clearer image.",
        signs_and_symptoms:
          "Could not identify clear signs and symptoms in the image."
      };
    }
  } catch (error) {
    console.error("Error diagnosing disease with Gemini (flash model):", error);
    return {
      condition: "Unknown",
      confidence: 0,
      recommendation: "Failed to diagnose disease. Please try again.",
      signs_and_symptoms: "Error during diagnosis."
    };
  }
};

/**
 * Extract JSON content from text
 * @param {string} text - Text that might contain JSON
 * @returns {Object|null} Extracted JSON object or null if not found
 */
const extractJsonFromText = (text) => {
  try {
    // Try direct parsing first
    return JSON.parse(text);
  } catch (e) {
    // Look for JSON pattern in the response
    const jsonPattern = /\{[\s\S]*?\}/;
    const jsonMatches = text.match(jsonPattern);

    if (jsonMatches) {
      try {
        return JSON.parse(jsonMatches[0]);
      } catch (jsonError) {
        console.warn(
          "Found JSON-like content but couldn't parse it:",
          jsonMatches[0]
        );
      }
    }
  }

  return null;
};

/**
 * Extract structured diagnosis information from Gemini response
 * @param {string} jsonResponse - JSON formatted string from Gemini
 * @returns {Object} - Parsed diagnosis data
 */
const extractDiagnosisInfo = (jsonResponse) => {
  try {
    // Try to parse the JSON from the response
    const matchJson = jsonResponse.match(/```json\s*([\s\S]*?)\s*```/);

    if (!matchJson) {
      console.error("No JSON found in Gemini response");
      return {
        condition: "Unknown",
        confidence: 0,
        recommendation: "Could not extract diagnosis information."
      };
    }

    const jsonContent = matchJson[1].trim();
    console.log("Extracted JSON content:", jsonContent);

    const diagnosisData = JSON.parse(jsonContent);

    // Validate the required fields
    if (!diagnosisData.condition) {
      console.error("Missing condition in parsed diagnosis data");
      return {
        condition: "Unknown",
        confidence: 0,
        recommendation: "Could not extract diagnosis information."
      };
    }

    // Format the recommendations array if it exists
    if (
      Array.isArray(diagnosisData.recommendations) &&
      diagnosisData.recommendations.length > 0
    ) {
      diagnosisData.recommendation = diagnosisData.recommendations.join(" ");
    }

    // Make sure the condition is one of the accepted values
    const validConditions = ["Healthy", "Early Blight", "Late Blight"];
    const normalizedCondition = diagnosisData.condition.trim();

    if (validConditions.includes(normalizedCondition)) {
      diagnosisData.condition = normalizedCondition;
    } else {
      console.warn(
        `Invalid condition "${diagnosisData.condition}" detected, setting to Unknown`
      );
      diagnosisData.condition = "Unknown";
    }

    // Ensure confidence is a number
    if (typeof diagnosisData.confidence !== "number") {
      diagnosisData.confidence = parseInt(diagnosisData.confidence) || 0;
    }

    // Rename symptoms field if needed
    if (diagnosisData.symptoms && !diagnosisData.signs_and_symptoms) {
      diagnosisData.signs_and_symptoms = diagnosisData.symptoms;
    }

    console.log("Successfully parsed diagnosis data:", diagnosisData);
    return diagnosisData;
  } catch (error) {
    console.error(
      "Failed to extract diagnosis information:",
      error,
      "\nOriginal response:",
      jsonResponse
    );
    return {
      condition: "Unknown",
      confidence: 0,
      recommendation: "Error extracting diagnosis information."
    };
  }
};

module.exports = {
  validateImage,
  diagnoseTomatoDisease
};
