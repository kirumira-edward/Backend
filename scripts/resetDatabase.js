const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const path = require("path");

// Models
const Farmer = require("../models/Farmer");
const Diagnosis = require("../models/Diagnosis");
const EnvironmentalData = require("../models/EnvironmentalData");
const Notification = require("../models/Notification");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const resetDatabase = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB successfully");

    // Ask for confirmation
    console.log("\n⚠️ WARNING: This will delete ALL data in your database!");
    console.log("Are you sure you want to proceed? (yes/no)");

    // Simple confirmation prompt using stdin
    process.stdin.once("data", async (data) => {
      const input = data.toString().trim().toLowerCase();

      if (input !== "yes") {
        console.log("Database reset cancelled.");
        process.exit(0);
      }

      try {
        console.log("\n🗑️ Clearing database collections...");

        // Delete all documents from collections
        await Promise.all([
          Farmer.deleteMany({}),
          Diagnosis.deleteMany({}),
          EnvironmentalData.deleteMany({}),
          Notification.deleteMany({})
        ]);

        console.log("✅ All collections cleared successfully");

        console.log("\n👨‍🌾 Creating new farmer account...");

        // Create a new verified farmer (already verified so you don't need to go through email verification)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash("password123", salt);

        const farmer = new Farmer({
          firstName: "Test",
          lastName: "Farmer",
          email: "farmer@example.com",
          password: hashedPassword,
          isVerified: true,
          defaultLocation: {
            latitude: 0.3321332652604399,
            longitude: 32.570457568263755
          },
          notificationSettings: {
            enablePush: true,
            enableEmail: true,
            weatherAlerts: true,
            blightRiskAlerts: true,
            farmingTips: true,
            diagnosisResults: true
          }
        });

        await farmer.save();
        console.log("✅ New farmer created with the following details:");
        console.log(`   Email: ${farmer.email}`);
        console.log(`   Password: password123`);
        console.log(`   Farmer ID: ${farmer._id}`);

        console.log(
          "\n🎉 Database reset complete. You can now log in with the new account."
        );
        process.exit(0);
      } catch (error) {
        console.error("❌ Error during database reset:", error);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error("❌ Database connection error:", error);
    process.exit(1);
  }
};

resetDatabase();
