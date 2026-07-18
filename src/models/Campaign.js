const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema({
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    type: {
      type: String,
      enum: ["email", "sms", "social", "push"],
      default: "email",
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    goal: {
      type: String,
      enum: [
        "awareness",
        "acquisition",
        "engagement",
        "retention",
        "conversion",
        "announcement",
        "other",
      ],
      required: false,
    },
    customers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    }],
    leads: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
    }],
    emailTemplate: {
      type: mongoose.Schema.Types.ObjectId,
        ref: "EmailTemplate",
        required: true,
    },
    isScheduled: {
      type: Boolean,
      default: false,
    },
    scheduledAt: {
      type: Date,
      required: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
        required: true,
    },
    startedAt: {
      type: Date,
      required: false,
    },
    completedAt: {
      type: Date,
      required: false,
    },
    status: {
      type: String,
      enum: ["draft", "scheduled", "running", "paused", "completed", "failed", "archived"],
      default: "draft",
    },
    isDeleted: {
      type: Boolean,
      default: false,
    }
},{timestamps: true});

CampaignSchema.index({ status: 1, isDeleted: 1 });
CampaignSchema.index({ tags: 1 });
CampaignSchema.index({ scheduledAt: 1 });
CampaignSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Campaign', CampaignSchema);