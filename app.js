// Import necessary modules
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cors = require("cors");

// Middleware setup
app.use(bodyParser.json());
app.use(cors());

// Import routes
const mapRoutes = require("./routes/mapRoutes");

// Mount routes
app.use("/api/map", mapRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
