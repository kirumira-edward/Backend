// Seeder.js
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Farmer = require("./models/Farmer");

dotenv.config();

mongoose
  .connect(process.env.MONGO_URI) // Removed deprecated options
  .then(() => console.log("MongoDB connected for seeding"))
  .catch((err) => console.log(err));

const seedFarmers = async () => {
  try {
    // Clear existing farmers
    await Farmer.deleteMany();

    // Add sample farmers with default profile photos
    await Farmer.create([
      {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        password: "password123"
        // profilePhoto will use the default value
      },
      {
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
        password: "password123"
        // profilePhoto will use the default value
      }
    ]);

    console.log("Sample farmers seeded successfully");
    process.exit(0); // Changed from mongoose.connection.close()
  } catch (err) {
    console.error("Error seeding data:", err);
    process.exit(1); // Changed from mongoose.connection.close()
  }
};

seedFarmers();
