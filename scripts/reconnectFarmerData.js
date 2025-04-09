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

const reconnectFarmerData = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB successfully");

    // Check if any farmers exist
    const existingFarmers = await Farmer.find({});
    if (existingFarmers.length > 0) {
      console.log("\n⚠️ There are still farmers in the database:");
      existingFarmers.forEach((farmer, idx) => {
        console.log(
          `   ${idx + 1}. ${farmer.firstName} ${farmer.lastName} (${
            farmer.email
          })`
        );
      });
      console.log(
        "\nDo you want to proceed with reconnecting orphaned data? (yes/no)"
      );

      process.stdin.once("data", async (data) => {
        const input = data.toString().trim().toLowerCase();

        if (input !== "yes") {
          console.log("Reconnection cancelled.");
          process.exit(0);
        }

        await proceedWithReconnection();
      });
    } else {
      console.log(
        "No farmers found in the database. Creating new farmer and reconnecting data..."
      );
      await proceedWithReconnection();
    }
  } catch (error) {
    console.error("❌ Database connection error:", error);
    process.exit(1);
  }
};

const proceedWithReconnection = async () => {
  try {
    // Create a new farmer
    console.log("\n👨‍🌾 Creating new farmer account...");

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

    // Find orphaned data (data without a valid farmerId reference)
    console.log("\n🔍 Finding orphaned data to reconnect...");

    // Check for environmental data without a valid farmer ID
    const orphanedEnvData = await EnvironmentalData.find({
      $or: [
        { farmerId: null },
        { farmerId: { $exists: false } },
        // Find data where farmerId doesn't match any existing farmer
        { farmerId: { $nin: (await Farmer.find({})).map((f) => f._id) } }
      ]
    });

    console.log(
      `   Found ${orphanedEnvData.length} orphaned environmental data records`
    );

    // Check for diagnoses without a valid farmer ID
    const orphanedDiagnoses = await Diagnosis.find({
      $or: [
        { farmerId: null },
        { farmerId: { $exists: false } },
        { farmerId: { $nin: (await Farmer.find({})).map((f) => f._id) } }
      ]
    });

    console.log(
      `   Found ${orphanedDiagnoses.length} orphaned diagnosis records`
    );

    // Check for notifications without a valid farmer ID
    const orphanedNotifications = await Notification.find({
      $or: [
        { farmerId: null },
        { farmerId: { $exists: false } },
        { farmerId: { $nin: (await Farmer.find({})).map((f) => f._id) } }
      ]
    });

    console.log(
      `   Found ${orphanedNotifications.length} orphaned notification records`
    );

    // Reconnect orphaned data to the new farmer
    console.log("\n🔄 Reconnecting data to the new farmer...");

    if (orphanedEnvData.length > 0) {
      await EnvironmentalData.updateMany(
        { _id: { $in: orphanedEnvData.map((d) => d._id) } },
        { $set: { farmerId: farmer._id } }
      );
      console.log("✅ Reconnected environmental data");
    }

    if (orphanedDiagnoses.length > 0) {
      await Diagnosis.updateMany(
        { _id: { $in: orphanedDiagnoses.map((d) => d._id) } },
        { $set: { farmerId: farmer._id } }
      );
      console.log("✅ Reconnected diagnoses");
    }

    if (orphanedNotifications.length > 0) {
      await Notification.updateMany(
        { _id: { $in: orphanedNotifications.map((n) => n._id) } },
        { $set: { farmerId: farmer._id } }
      );
      console.log("✅ Reconnected notifications");
    }

    console.log(
      "\n🎉 Data reconnection complete. You can now log in with the new account."
    );
    console.log("Remember to use these credentials:");
    console.log(`   Email: ${farmer.email}`);
    console.log(`   Password: password123`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error during data reconnection:", error);
    process.exit(1);
  }
};

reconnectFarmerData();
