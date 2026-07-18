const Campaign = require("../models/Campaign");

const VALID_STATUSES = ["draft", "scheduled", "running", "paused", "completed", "failed", "archived"];

// One-off migration: normalizes legacy status values against the new enum.
const normalizeCampaignStatus = async () => {
  const capitalizedResult = await Campaign.updateMany(
    { status: "Completed" },
    { $set: { status: "completed" } }
  );

  const scheduledResult = await Campaign.updateMany(
    {
      status: "draft",
      isScheduled: true,
      scheduledAt: { $gt: new Date() },
    },
    { $set: { status: "scheduled" } }
  );

  const unrecognizedResult = await Campaign.updateMany(
    { status: { $nin: VALID_STATUSES } },
    { $set: { status: "draft" } }
  );

  console.log(
    `Normalization complete: ${capitalizedResult.modifiedCount} "Completed"->"completed", ` +
      `${scheduledResult.modifiedCount} backfilled to "scheduled", ` +
      `${unrecognizedResult.modifiedCount} unrecognized values reset to "draft".`
  );
};

module.exports = { normalizeCampaignStatus };

if (require.main === module) {
  require("dotenv").config();
  const mongoose = require("mongoose");

  (async () => {
    if (!process.env.MONGO_URI) {
      console.error("MONGO_URI must be set in the environment before running this script.");
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    try {
      await normalizeCampaignStatus();
    } finally {
      await mongoose.disconnect();
    }
  })().catch((error) => {
    console.error("Failed to normalize campaign statuses:", error);
    process.exit(1);
  });
}
