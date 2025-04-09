/**
 * Central error handler for API endpoints
 * @param {Error} error - The error object
 * @param {Object} res - Express response object
 * @param {string} message - Custom message to display to the user
 * @param {number} statusCode - HTTP status code to return
 */
const handleApiError = (
  error,
  res,
  message = "An error occurred",
  statusCode = 500
) => {
  // Log the full error for debugging
  console.error(`API Error - ${message}:`, error);

  // Send a clean response to the client
  res.status(statusCode).json({
    status: "error",
    message,
    error: process.env.NODE_ENV === "development" ? error.message : undefined
  });
};

module.exports = {
  handleApiError
};
