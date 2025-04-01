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

module.exports = {
  sendVerificationEmail,
  sendEmail
};
