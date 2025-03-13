require('dotenv').config();
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// Verification Email
const sendVerificationEmail = async (email, verificationCode) => {
  try {
    await resend.emails.send({
      from: "no-reply@yourdomain.com",
      to: email,
      subject: "Verify Your Email Address",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 30px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb; border-bottom: 2px solid #eee; padding-bottom: 10px;">
            Email Verification Required
          </h2>
          <p style="font-size: 16px; line-height: 1.6;">
            Your verification code is:
          </p>
          <div style="font-size: 32px; letter-spacing: 5px; margin: 25px 0;
              padding: 20px; background: #f8fafc; border-radius: 8px;
              text-align: center; font-weight: bold;">
            ${verificationCode}
          </div>
          <p style="font-size: 14px; color: #64748b;">
            This code will expire in ${process.env.VERIFICATION_CODE_EXPIRES_MINUTES} minutes.
          </p>
        </div>
      `
    });
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error('Failed to send verification email');
  }
};

// Password Reset Email (keep existing)
const sendPasswordResetEmail = async (email, token) => {
  const resetLink = `${process.env.BASE_URL}/reset-password?token=${token}`;
  
  try {
    await resend.emails.send({
      from: "no-reply@yourdomain.com",
      to: email,
      subject: "Password Reset Request",
      html: `<p>Click <a href="${resetLink}">here</a> to reset your password.</p>`
    });
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail };