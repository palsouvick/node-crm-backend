const mongoose = require("mongoose");

const CampaignRecipientScheme = new mongoose.Schema(
  {
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "recipientType",
    },
    recipientType: {
      type: String,
      required: true,
      enum: ["Customer", "Lead"],
    },
    status: {
      type: String,
      enum: ["pending", "sent", "opened", "clicked", "bounced", "unsubscribed", "failed"],
      default: "pending",
    },
    sentAt: {
      type: Date,
      required: false,
    },
    openedAt: {
      type: Date,
      required: false,
    },
    clickedAt: {
      type: Date,
      required: false,
    },
  },
  { timestamps: true }
);

CampaignRecipientScheme.index({ campaign: 1, status: 1 });
CampaignRecipientScheme.index({ recipientId: 1, recipientType: 1 });

module.exports = mongoose.model("CampaignRecipient", CampaignRecipientScheme);
