const mongoose = require("mongoose");

const FollowUpSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead"
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["call", "meeting", "email", "demo", "payment"],
      required: true,
    },
    followUpDate: {
      type: Date,
      required: true,
    },
    followUpNotes: {
      type: String,
    },
    followUpStatus: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    reminderSent: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);


// Indexes for efficient querying
FollowUpSchema.index({ customer: 1 });
FollowUpSchema.index({ lead: 1 });
FollowUpSchema.index({ assignedTo: 1 });
FollowUpSchema.index({ followUpDate: 1 });

module.exports = mongoose.model("FollowUp", FollowUpSchema);