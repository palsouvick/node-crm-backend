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
      default: "email",
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
      default: "draft",
    },
    isDeleted: {
      type: Boolean,
      default: false,
    }
},{timestamps: true});

module.exports = mongoose.model('Campaign', CampaignSchema);