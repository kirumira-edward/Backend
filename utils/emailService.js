// utils/emailService.js
const { Resend } = require("resend");
const dotenv = require("dotenv");

dotenv.config();

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send verification email with code
 * @param {string} to - Recipient email
 * @param {string} firstName - Recipient first name
 * @param {string} code - Verification code
 */
const sendVerificationEmail = async (to, firstName, code) => {
  try {
    const { data, error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: [to],
      subject: "Verify Your Email Address",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #4b7f52;">Hello ${firstName},</h2>
          <p>Thank you for registering with Tomato Blight AI Assessment System.</p>
          <p>Your verification code is:</p>
          <div style="background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 15px 0;">
            ${code}
          </div>
          <p>This code will expire in 1 hour.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <p>Best regards,<br>The Tomato Blight AI Team</p>
        </div>
      `
    });

    if (error) {
      console.error("Email sending failed:", error);
      throw new Error("Failed to send verification email");
    }

    return data;
  } catch (error) {
    console.error("Email service error:", error);
    throw error;
  }
};

/**
 * Send general email notification
 * @param {string} to - Recipient email
 * @param {string} firstName - Recipient first name
 * @param {string} subject - Email subject
 * @param {string} message - Email message
 */
const sendEmail = async (to, firstName, subject, message) => {
  try {
    const { data, error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: [to],
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #4b7f52;">Hello ${firstName},</h2>
          <p>${message}</p>
          <p>Best regards,<br>The Tomato Blight AI Team</p>
        </div>
      `
    });

    if (error) {
      console.error("Email sending failed:", error);
      throw new Error("Failed to send email");
    }

    return data;
  } catch (error) {
    console.error("Email service error:", error);
    throw error;
  }
};

/**
 * Send password reset email with code
 * @param {string} to - Recipient email
 * @param {string} firstName - Recipient first name
 * @param {string} code - Password reset code
 */
const sendPasswordResetEmail = async (to, firstName, code) => {
  try {
    const { data, error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: [to],
      subject: "Reset Your Password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #4b7f52;">Hello ${firstName},</h2>
          <p>We received a request to reset your password for your Tomato Blight AI Assessment System account.</p>
          <p>Your password reset code is:</p>
          <div style="background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 15px 0;">
            ${code}
          </div>
          <p>This code will expire in 1 hour.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <p>Best regards,<br>The Tomato Blight AI Team</p>
        </div>
      `
    });

    if (error) {
      console.error("Email sending failed:", error);
      throw new Error("Failed to send password reset email");
    }

    return data;
  } catch (error) {
    console.error("Email service error:", error);
    throw error;
  }
};

// Add this new function to send diagnosis emails with professional formatting

const sendDiagnosisEmail = async (to, firstName, diagnosis) => {
  try {
    const { data, error } = await resend.emails.send({
      from: "diagnosis@tomato-expert.com",
      to: [to],
      subject: `Tomato Diagnosis Result: ${diagnosis.condition}`,
      html: `
        <div style="font-family: 'Arial', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; color: #333;">
          <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #4b7f52;">
            <img src="https://tomato-expert-frontend.onrender.com/logo.png" alt="Tomato Expert Logo" width="120" style="margin-bottom: 10px;">
            <h1 style="color: #4b7f52; margin: 0;">Tomato Diagnosis Results</h1>
          </div>
          
          <div style="padding: 20px 0;">
            <h2 style="color: #333; margin-top: 0;">Hello ${firstName},</h2>
            <p>Your tomato plant diagnosis is complete. Here are the results:</p>
            
            <div style="background-color: ${getBgColorForCondition(diagnosis.condition)}; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #fff;">Diagnosis: ${diagnosis.condition}</h3>
              <p style="color: #fff; margin-bottom: 5px;">Confidence: <strong>${diagnosis.confidence}%</strong></p>
            </div>
            
            <h3 style="color: #4b7f52;">Observed Symptoms</h3>
            <p>${diagnosis.signs_and_symptoms || diagnosis.symptoms}</p>
            
            <h3 style="color: #4b7f52;">Recommendations</h3>
            <ul>
              ${formatRecommendations(diagnosis.recommendation)}
            </ul>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h3 style="color: #4b7f52; margin-top: 0;">Local Resources</h3>
              <ul style="padding-left: 20px;">
                <li><a href="https://www.maaif.go.ug/" style="color: #4b7f52;">Ministry of Agriculture, Uganda</a></li>
                <li><a href="https://www.naro.go.ug/" style="color: #4b7f52;">National Agricultural Research Organisation</a></li>
                <li>Contact your local extension officer: 0800-327-329</li>
              </ul>
            </div>
          </div>
          
          <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #777; font-size: 12px;">
            <p>This diagnosis is based on image analysis and environmental factors. For critical cases, consult with a local agricultural expert.</p>
            <p>© ${new Date().getFullYear()} Tomato Expert AI - <a href="https://tomato-expert-frontend.onrender.com" style="color: #4b7f52;">Visit Website</a></p>
          </div>
        </div>
      `
    });

    if (error) {
      console.error("Email sending failed:", error);
      throw new Error("Failed to send diagnosis email");
    }

    return data;
  } catch (error) {
    console.error("Email service error:", error);
    throw error;
  }
};

// Helper functions for email formatting
function getBgColorForCondition(condition) {
  const conditionLower = condition.toLowerCase();
  if (conditionLower.includes('healthy')) return '#4b7f52';
  if (conditionLower.includes('early blight')) return '#e67e22';
  if (conditionLower.includes('late blight')) return '#c0392b';
  return '#7f8c8d';
}

function formatRecommendations(recommendation) {
  // Convert paragraph to bullet points if needed
  if (typeof recommendation === 'string') {
    const points = recommendation.split(/\.\s+/);
    return points
      .filter(point => point.trim().length > 0)
      .map(point => `<li>${point}${!point.endsWith('.') ? '.' : ''}</li>`)
      .join('');
  }
  
  // If it's already an array
  if (Array.isArray(recommendation)) {
    return recommendation
      .map(point => `<li>${point}</li>`)
      .join('');
  }
  
  return '<li>No specific recommendations available.</li>';
}


module.exports = {
  sendVerificationEmail,
  sendEmail,
  sendPasswordResetEmail,
  sendDiagnosisEmail
};
