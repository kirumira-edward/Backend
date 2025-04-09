// Seeder.js
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Farmer = require("./models/Farmer");
const readline = require("readline");

dotenv.config();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected for seeding");

    // Safety check - confirm before proceeding
    rl.question(
      "\n⚠️ WARNING: Running this seeder will DELETE ALL existing farmers. Are you sure you want to continue? (yes/no): ",
      async (answer) => {
        if (answer.toLowerCase() !== "yes") {
          console.log("Seeding cancelled.");
          rl.close();
          process.exit(0);
          return;
        }

        try {
          // Count existing farmers
          const existingCount = await Farmer.countDocuments();
          console.log(
            `Found ${existingCount} existing farmer records that will be deleted.`
          );

          // Final confirmation if farmers exist
          if (existingCount > 0) {
            rl.question(
              "⚠️ FINAL WARNING: This is a production safety check. Type 'DELETE' to confirm deletion: ",
              async (confirmation) => {
                if (confirmation !== "DELETE") {
                  console.log("Seeding cancelled.");
                  rl.close();
                  process.exit(0);
                  return;
                }

                await runSeeder();
                rl.close();
              }
            );
          } else {
            await runSeeder();
            rl.close();
          }
        } catch (err) {
          console.error("Error checking for existing data:", err);
          rl.close();
          process.exit(1);
        }
      }
    );
  })
  .catch((err) => {
    console.log("MongoDB connection error:", err);
    process.exit(1);
  });

async function runSeeder() {
  try {
    // Clear existing farmers
    await Farmer.deleteMany();
    console.log("Existing farmers deleted successfully");

    // Add sample farmers with default profile photos
    const farmers = await Farmer.create([
      {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        password: "password123",
        isVerified: true // Set to true so you can login directly
      },
      {
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
        password: "password123",
        isVerified: true // Set to true so you can login directly
      }
    ]);

    console.log("Sample farmers seeded successfully:");
    farmers.forEach((farmer) => {
      console.log(`- ${farmer.firstName} ${farmer.lastName} (${farmer.email})`);
    });

    process.exit(0);
  } catch (err) {
    console.error("Error seeding data:", err);
    process.exit(1);
  }
}
