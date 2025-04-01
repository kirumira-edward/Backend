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

      Also, provide a confidence percentage (0-100) for your diagnosis based on how clear the signs are in the image.

      Finally, offer specific recommendations for a farmer in Uganda on how to manage this condition, including best practices, preventive measures, or potential medications relevant to the identified disease.

      Specifically describe the **signs and symptoms you observed in the image** that led to your diagnosis.

      Consider the Cumulative Risk Index (CRI) of ${cri}. A CRI below 50 suggests a higher likelihood of Early Blight, while a CRI above 50 suggests a higher likelihood of Late Blight. Use this as additional context.

      Format your response as a JSON object with the following keys:
      - "condition": The identified disease ("Healthy", "Early Blight", "Late Blight", or "Unknown").
      - "confidence": The confidence percentage (0-100).
      - "recommendation": A detailed recommendation for the farmer.
      - "signs_and_symptoms": A string describing the observed signs and symptoms.

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

    const responseText =
      response.data.candidates[0]?.content?.parts[0]?.text || "";

    const diagnosis = extractJsonFromText(responseText);

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

module.exports = {
  validateImage,
  diagnoseTomatoDisease
};
