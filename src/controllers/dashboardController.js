const Customer = require("../models/Customer");
const Lead = require("../models/Lead");
const FollowUp = require("../models/FollowUp");
const ActivityLog = require("../models/ActivityLog");

const MONTH_NAMES = [
  "",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const getLeadsGrowth = async () => {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const rows = await Lead.aggregate([
    { $match: { isDeleted: false, createdAt: { $gte: sixMonthsAgo } } },
    {
      $group: {
        _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);

  return rows.map((row) => ({
    month: MONTH_NAMES[row._id.month],
    leads: row.count,
  }));
};

const getLeadStatusDistribution = async () => {
  const rows = await Lead.aggregate([
    { $match: { isDeleted: false } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  return rows.map((row) => ({
    name: row._id ? row._id.charAt(0).toUpperCase() + row._id.slice(1) : "Unknown",
    status: row._id,
    value: row.count,
  }));
};

// GET /dashboard/summary
exports.getSummary = async (req, res) => {
  try {
    const [
      totalCustomers,
      totalLeads,
      totalFollowUps,
      totalActivities,
      leadsGrowth,
      leadStatus,
    ] = await Promise.all([
      Customer.countDocuments({ isDeleted: false }),
      Lead.countDocuments({ isDeleted: false }),
      FollowUp.countDocuments({ isDeleted: false }),
      ActivityLog.countDocuments(),
      getLeadsGrowth(),
      getLeadStatusDistribution(),
    ]);

    res.json({
      customers: { total: totalCustomers },
      leads: { total: totalLeads },
      followUps: { total: totalFollowUps },
      activities: { total: totalActivities },
      leadsGrowth,
      leadStatus,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
