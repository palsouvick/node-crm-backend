const mongoose = require("mongoose");

const CampaignRecipientScheme = new mongoose.Schema(
  {
    campaign: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Campaign",
      },
    ],
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

module.exports = mongoose.model("CampaignRecipient", CampaignRecipientScheme);
