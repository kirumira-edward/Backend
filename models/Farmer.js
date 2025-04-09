// Farmer.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const farmerSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true
    },
    lastName: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      unique: true
    },
    password: {
      type: String,
      required: true
    },
    profilePhoto: {
      type: String,
      default: "user.png"
    },
    defaultLocation: {
      latitude: Number,
      longitude: Number
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    verificationCode: {
      type: String
    },
    verificationCodeExpires: {
      type: Date
    },
    refreshToken: {
      type: String
    },
    deviceTokens: [
      {
        type: String
      }
    ],
    notificationSettings: {
      enablePush: {
        type: Boolean,
        default: true
      },
      enableEmail: {
        type: Boolean,
        default: true
      },
      weatherAlerts: {
        type: Boolean,
        default: true
      },
      blightRiskAlerts: {
        type: Boolean,
        default: true
      },
      farmingTips: {
        type: Boolean,
        default: true
      },
      diagnosisResults: {
        type: Boolean,
        default: true
      }
    },
    rememberMe: {
      type: Boolean,
      default: false
    },
    lastActive: {
      type: Date,
      default: Date.now
    },
    preferences: {
      camera: {
        type: Boolean,
        default: false
      },
      location: {
        type: Boolean,
        default: false
      },
      notifications: {
        type: Boolean,
        default: false
      },
      dataSync: {
        type: Boolean,
        default: true
      },
      analytics: {
        type: Boolean,
        default: true
      },
      offline: {
        type: Boolean,
        default: false
      }
    }
  },
  { timestamps: true }
);

// Method to compare passwords
farmerSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Add to the farmerSchema:

farmerSchema.virtual("environmentalData", {
  ref: "EnvironmentalData",
  localField: "_id",
  foreignField: "farmerId"
});

// Generate verification code
farmerSchema.methods.generateVerificationCode = function () {
  // Generate a random 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // Set code and expiration (1 hour from now)
  this.verificationCode = code;
  this.verificationCodeExpires = Date.now() + 3600000; // 1 hour

  return code;
};

// Hash password before saving
farmerSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

const Farmer = mongoose.model("Farmer", farmerSchema);
module.exports = Farmer;
