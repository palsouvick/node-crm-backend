const Campaign = require("../models/Campaign");
const { runCampaignSend } = require("../controllers/campaignController");

const POLL_INTERVAL_MS = 60 * 1000;

// One-time scheduled sending only (no recurring-campaign support) — checks
// the clock every 60s for campaigns whose scheduledAt has arrived. A plain
// interval poller, not node-cron: nothing in this backend needs calendar
// expressions, just "has the time passed yet."
const pollScheduledCampaigns = async () => {
  const dueCampaigns = await Campaign.find({
    status: "scheduled",
    isDeleted: false,
    scheduledAt: { $lte: new Date() },
  }).select("_id");

  for (const { _id } of dueCampaigns) {
    // Status-guarded claim so a second poller tick (or a future
    // horizontally-scaled deployment) can't double-send the same campaign.
    const claimed = await Campaign.findOneAndUpdate(
      { _id, status: "scheduled" },
      { $set: { status: "running", startedAt: new Date() } }
    );
    if (!claimed) continue;

    try {
      await runCampaignSend(_id, null);
    } catch (error) {
      console.error(`Scheduled send failed for campaign ${_id}:`, error);
    }
  }
};

const startCampaignScheduler = () => {
  setInterval(() => {
    pollScheduledCampaigns().catch((error) => {
      console.error("Campaign scheduler poll failed:", error);
    });
  }, POLL_INTERVAL_MS);
};

module.exports = { startCampaignScheduler };
