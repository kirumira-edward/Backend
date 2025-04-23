const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { executeDataCollection } = require("../utils/dataScheduler");

// Models
const Farmer = require("../models/Farmer");
const EnvironmentalData = require("../models/EnvironmentalData");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Create readline interface for confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Uganda region coordinates (approximate)
const ugandaRegions = {
  // Central region districts
  central: [
    { name: "Kampala", lat: 0.3476, lng: 32.5825, district: "Kampala" },
    { name: "Entebbe", lat: 0.0512, lng: 32.4633, district: "Wakiso" },
    { name: "Mukono", lat: 0.3533, lng: 32.7552, district: "Mukono" },
    { name: "Mityana", lat: 0.4175, lng: 32.0228, district: "Mityana" },
    { name: "Masaka", lat: -0.3333, lng: 31.7333, district: "Masaka" },
    { name: "Mpigi", lat: 0.2167, lng: 32.3, district: "Mpigi" },
    { name: "Kayunga", lat: 0.7022, lng: 32.8903, district: "Kayunga" },
    { name: "Luwero", lat: 0.85, lng: 32.4667, district: "Luwero" },
    { name: "Nakasongola", lat: 1.3089, lng: 32.4561, district: "Nakasongola" },
    { name: "Buikwe", lat: 0.3353, lng: 33.0019, district: "Buikwe" }
  ],

  // Eastern region districts
  eastern: [
    { name: "Jinja", lat: 0.425, lng: 33.2028, district: "Jinja" },
    { name: "Mbale", lat: 1.075, lng: 34.1753, district: "Mbale" },
    { name: "Tororo", lat: 0.6925, lng: 34.1814, district: "Tororo" },
    { name: "Soroti", lat: 1.7122, lng: 33.6119, district: "Soroti" },
    { name: "Busia", lat: 0.4608, lng: 34.0922, district: "Busia" },
    { name: "Iganga", lat: 0.6092, lng: 33.4689, district: "Iganga" },
    { name: "Kamuli", lat: 0.9472, lng: 33.1203, district: "Kamuli" },
    { name: "Pallisa", lat: 1.145, lng: 33.7094, district: "Pallisa" },
    { name: "Kapchorwa", lat: 1.4024, lng: 34.4506, district: "Kapchorwa" },
    { name: "Kumi", lat: 1.4608, lng: 33.9361, district: "Kumi" }
  ],

  // Western region districts
  western: [
    { name: "Mbarara", lat: -0.6167, lng: 30.65, district: "Mbarara" },
    { name: "Fort Portal", lat: 0.6712, lng: 30.2747, district: "Kabarole" },
    { name: "Kasese", lat: 0.1833, lng: 30.0833, district: "Kasese" },
    { name: "Kabale", lat: -1.2486, lng: 29.9889, district: "Kabale" },
    { name: "Bushenyi", lat: -0.5875, lng: 30.2111, district: "Bushenyi" },
    { name: "Hoima", lat: 1.4332, lng: 31.3606, district: "Hoima" },
    { name: "Masindi", lat: 1.6747, lng: 31.715, district: "Masindi" },
    { name: "Rukungiri", lat: -0.8417, lng: 29.9411, district: "Rukungiri" },
    { name: "Ntungamo", lat: -0.8794, lng: 30.2647, district: "Ntungamo" },
    { name: "Kisoro", lat: -1.2167, lng: 29.7, district: "Kisoro" }
  ],

  // Northern region districts
  northern: [
    { name: "Gulu", lat: 2.7747, lng: 32.2992, district: "Gulu" },
    { name: "Lira", lat: 2.2499, lng: 32.8997, district: "Lira" },
    { name: "Arua", lat: 3.0288, lng: 30.9073, district: "Arua" },
    { name: "Kitgum", lat: 3.2784, lng: 32.8867, district: "Kitgum" },
    { name: "Moroto", lat: 2.5339, lng: 34.6514, district: "Moroto" },
    { name: "Moyo", lat: 3.6498, lng: 31.728, district: "Moyo" },
    { name: "Nebbi", lat: 2.4779, lng: 31.0883, district: "Nebbi" },
    { name: "Adjumani", lat: 3.3773, lng: 31.7916, district: "Adjumani" },
    { name: "Pader", lat: 2.8, lng: 33.2167, district: "Pader" },
    { name: "Kotido", lat: 2.9806, lng: 34.1331, district: "Kotido" }
  ]
};

// Common Ugandan names for generating realistic farmer data
const ugandanFirstNames = [
  "Mukasa",
  "Acheng",
  "Adong",
  "Agaba",
  "Akello",
  "Auma",
  "Byamukama",
  "Mugisha",
  "Mutesi",
  "Namukasa",
  "Nantongo",
  "Nsubuga",
  "Okello",
  "Okot",
  "Opio",
  "Tusiime",
  "Walusimbi",
  "Wanyama",
  "Kisakye",
  "Nabirye",
  "Nalwoga",
  "Asiimwe",
  "Atuhaire",
  "Babirye",
  "Bbosa",
  "Birungi",
  "Kato",
  "Kirabo",
  "Kiiza",
  "Muwonge",
  "Nakato"
];

const ugandanLastNames = [
  "Tumwesigye",
  "Mugabi",
  "Kyambadde",
  "Nabbosa",
  "Musoke",
  "Ssekandi",
  "Namutebi",
  "Waiswa",
  "Tusiime",
  "Mwesigwa",
  "Namugwanya",
  "Kabuye",
  "Wasswa",
  "Kizza",
  "Namugenyi",
  "Nanyonga",
  "Katushabe",
  "Mugume",
  "Babirye",
  "Nankinga",
  "Mugisha",
  "Atim",
  "Ochieng",
  "Baguma",
  "Namyalo",
  "Ahimbisibwe",
  "Nakiganda",
  "Nassimbwa"
];

// Function to generate a unique email
const generateEmail = (firstName, lastName, index) => {
  const domains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com"];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@${domain}`;
};

// Function to add slight variation to coordinates
const addCoordinateVariation = (coord) => {
  // Add random variation of up to ±0.05 degrees
  return coord + (Math.random() * 0.1 - 0.05);
};

// Main seeding function
const seedRegionalFarmers = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB successfully");

    // Confirm before proceeding
    rl.question(
      "\n⚠️ This will create 100 dummy farmers across Uganda regions. Continue? (yes/no): ",
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
            `Currently there are ${existingCount} farmers in the database.`
          );

          console.log("\n🌱 Starting to seed farmers across Uganda...");

          // Create arrays to hold all regions
          const allRegions = [
            ...ugandaRegions.central,
            ...ugandaRegions.eastern,
            ...ugandaRegions.western,
            ...ugandaRegions.northern
          ];

          // Farmers to create
          const farmersToCreate = [];

          // Generate 100 farmers with locations across Uganda
          for (let i = 0; i < 100; i++) {
            // Select a random location, with some bias to create clusters
            const regionIndex = Math.floor(Math.random() * allRegions.length);
            const baseLocation = allRegions[regionIndex];

            // Add some variation to coordinates for farmers in the same area
            const latitude = addCoordinateVariation(baseLocation.lat);
            const longitude = addCoordinateVariation(baseLocation.lng);

            // Generate farmer name
            const firstName =
              ugandanFirstNames[
                Math.floor(Math.random() * ugandanFirstNames.length)
              ];
            const lastName =
              ugandanLastNames[
                Math.floor(Math.random() * ugandanLastNames.length)
              ];

            // Create hashed password (same for all dummy accounts for simplicity)
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash("farmer123", salt);

            farmersToCreate.push({
              firstName,
              lastName,
              email: generateEmail(firstName, lastName, i),
              password: hashedPassword,
              isVerified: true,
              defaultLocation: {
                latitude,
                longitude
              },
              region: Object.keys(ugandaRegions).find((region) =>
                ugandaRegions[region].some(
                  (loc) => loc.name === baseLocation.name
                )
              ),
              district: baseLocation.district,
              locationName: baseLocation.name,
              notificationSettings: {
                enablePush: Math.random() > 0.3, // 70% enable push
                enableEmail: Math.random() > 0.2, // 80% enable email
                weatherAlerts: Math.random() > 0.1,
                blightRiskAlerts: true,
                farmingTips: Math.random() > 0.3,
                diagnosisResults: true
              },
              createdAt: new Date(
                Date.now() -
                  Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000
              ) // Random creation date within last 30 days
            });
          }

          // Insert all farmers at once
          console.log(`Creating ${farmersToCreate.length} farmers...`);
          const farmers = await Farmer.insertMany(farmersToCreate);
          console.log(`✅ Created ${farmers.length} farmers successfully`);

          // Generate environmental data for each farmer
          console.log("\n🔄 Generating environmental data for each farmer...");
          const environmentalPromises = [];

          for (const farmer of farmers) {
            environmentalPromises.push(
              executeDataCollection(farmer.defaultLocation, farmer._id).catch(
                (err) => {
                  console.error(
                    `Error generating data for farmer ${farmer._id}:`,
                    err
                  );
                  return null;
                }
              )
            );
          }

          // Wait for all environmental data to be generated
          await Promise.all(environmentalPromises);
          console.log("✅ Generated environmental data for all farmers");

          // Generate summary statistics
          const envDataCount = await EnvironmentalData.countDocuments();
          const highRiskCount = await EnvironmentalData.countDocuments({
            riskLevel: { $in: ["High", "Critical"] }
          });

          console.log("\n📊 Regional Farmer Distribution:");
          for (const region of Object.keys(ugandaRegions)) {
            const count = await Farmer.countDocuments({
              region: region
            });
            console.log(
              `   ${
                region.charAt(0).toUpperCase() + region.slice(1)
              }: ${count} farmers`
            );
          }

          console.log("\n📈 Environmental Data Summary:");
          console.log(`   Total environmental data records: ${envDataCount}`);
          console.log(
            `   High/Critical risk areas: ${highRiskCount} (${Math.round(
              (highRiskCount / envDataCount) * 100
            )}%)`
          );

          console.log(
            "\n🎉 Seeding complete! You can now visualize this data on the map."
          );
          console.log("   All dummy farmers have password: farmer123");

          rl.close();
          process.exit(0);
        } catch (error) {
          console.error("❌ Error seeding regional farmers:", error);
          rl.close();
          process.exit(1);
        }
      }
    );
  } catch (error) {
    console.error("❌ Database connection error:", error);
    rl.close();
    process.exit(1);
  }
};

// Run the seeder
seedRegionalFarmers();
