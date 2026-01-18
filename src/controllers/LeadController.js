const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const { Parser } = require("json2csv");

// Create a new lead
exports.createLead = async (req, res) => {
  try {
    const {
      customer,
      title,
      description,
      status,
      expectedValue,
      assignedTo,
      remarks,
      source,
    } = req.body;
    if (!customer) {
      return res.status(400).json({ message: "Name and email are required" });
    }
    const lead = await Lead.create({
      customer, // Customer ID
      title,
      description,
      status: status || "new",
      expectedValue: expectedValue || 0,
      assignedTo: assignedTo || null,
      remarks,
      source: source || "website",
      createdBy: req.user._id, // from JWT
    });
    await lead.save();
    res.status(201).json({ message: "Lead created successfully", lead });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all leads
exports.getLeads = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [leads, total] = await Promise.all([
      Lead.find()
        .populate("assignedTo", "name email")
        .populate("createdBy", "name email")
        .populate("customer", "name email phone")
        .skip(skip)
        .limit(limit),
      Lead.countDocuments(),
    ]);

    res.json({
      data: leads,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getLeadById = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * 10;

    const lead = await Lead.findById(req.params.id)
      .skip(skip)
      .limit(limit)
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .populate("customer", "name email phone company");
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }
    res.json({ lead });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update a lead
exports.updateLead = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid lead ID" });
  }
  try {
    const allowedFields = [
      "name",
      "email",
      "phone",
      "source",
      "status",
      "assignedTo",
      "notes",
    ];
    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });
    const lead = await Lead.findByIdAndUpdate(id, updates, { new: true });
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }
    res.json({ message: "Lead updated successfully", lead });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete a lead
exports.deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }
    res.json({ message: "Lead deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Add a note to a lead
exports.searchLeads = async (req, res) => {
  try {
    const { query } = req.query;
    const leads = await Lead.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
        { phone: { $regex: query, $options: "i" } },
      ],
    })
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email");
    res.json({ leads });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.assignLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;

    // 1️⃣ Validate Lead ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid lead ID" });
    }

    // 2️⃣ Validate assigned user
    if (!assignedTo || !mongoose.Types.ObjectId.isValid(assignedTo)) {
      return res.status(400).json({ message: "Invalid assigned user ID" });
    }
    const user = await User.findById(assignedTo);
    if (!user) {
      return res.status(404).json({ message: "Assigned user not found" });
    }

    // 3️⃣ Update the lead's assignedTo field
    const lead = await Lead.findByIdAndUpdate(
      id,
      { assignedTo },
      { new: true },
    );
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }
    res.json({ message: "Lead assigned successfully", lead });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.totalLeads = async (req, res) => {
  try {
    const total = await Lead.countDocuments();
    res.json({ total });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get leads growth data (last 6 months)
exports.getLeadsGrowth = async (req, res) => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const leadsGrowth = await Lead.aggregate([
      {
        $match: {
          isDeleted: false,
          createdAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
      {
        $project: {
          _id: 0,
          month: {
            $let: {
              vars: {
                monthsInString: [
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
                ],
              },
              in: { $arrayElemAt: ["$$monthsInString", "$_id.month"] },
            },
          },
          leads: "$count",
        },
      },
    ]);

    res.json(leadsGrowth);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get lead status distribution
exports.getLeadStatus = async (req, res) => {
  try {
    const statusDistribution = await Lead.aggregate([
      {
        $match: { isDeleted: false },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          name: {
            $concat: [
              { $toUpper: { $substrCP: ["$_id", 0, 1] } },
              { $substrCP: ["$_id", 1, { $strLenCP: "$_id" }] },
            ],
          },
          value: "$count",
          color: {
            $switch: {
              branches: [
                { case: { $eq: ["$_id", "new"] }, then: "#6366f1" },
                { case: { $eq: ["$_id", "contacted"] }, then: "#10b981" },
                { case: { $eq: ["$_id", "qualified"] }, then: "#f59e0b" },
                { case: { $eq: ["$_id", "won"] }, then: "#8b5cf6" },
                { case: { $eq: ["$_id", "lost"] }, then: "#ef4444" },
              ],
              default: "#6b7280",
            },
          },
        },
      },
    ]);

    res.json(statusDistribution);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.exportLeadData = async (req, res) => {
  try {
    const leads = await Lead.find({ isDeleted: false })
      .populate("customer", "name email phone")
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email");

    const leadsData = leads.map((lead) => ({
      name: lead.customer.name,
      email: lead.customer.email,
      phone: lead.customer.phone,
      status: lead.status,
      source: lead.source,
      assignedTo: lead.assignedTo ? lead.assignedTo.name : null,
      createdBy: lead.createdBy ? lead.createdBy.name : null,
      createdAt: lead.createdAt,
    }));

    const fields = [
      { label: "Lead Name", value: "name" },
      { label: "Email", value: "email" },
      { label: "Phone", value: "phone" },
      { label: "Status", value: "status" },
      { label: "Source", value: "source" },
      { label: "Assigned To", value: "assignedTo" },
      { label: "Created By", value: "createdBy" },
      { label: "Created At", value: "createdAt" },
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(leadsData);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=leads.csv");

    return res.status(200).send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
