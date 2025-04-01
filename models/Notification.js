const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farmer",
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ["weather", "blight", "tip", "diagnosis", "system"],
      default: "system",
      index: true
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium"
    },
    read: {
      type: Boolean,
      default: false,
      index: true
    },
    data: {
      // Additional data related to the notification
      type: mongoose.Schema.Types.Mixed
    },
    expiresAt: {
      type: Date,
      default: () => new Date(+new Date() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      index: true
    },
    deviceTokens: [
      {
        type: String
      }
    ]
  },
  { timestamps: true }
);

// Create compound indexes for efficient querying
notificationSchema.index({ farmerId: 1, read: 1 });
notificationSchema.index({ type: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);
module.exports = Notification;
