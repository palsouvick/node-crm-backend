const Activity = require("../models/ActivityLog");

exports.getActivitys = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const skip = (req.query.page - 1) * limit;
    const page = Number(req.query.page) || 1;
    const search = req.query.search;
    console.log(req.query.limit);
    const [activities, total] = await Promise.all([
      Activity.find()
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      Activity.countDocuments(),
    ]);
    res.status(200).json({
      data: activities,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
