const mongoose = require("mongoose");
const Lead = require("../models/Lead");

// Create a new lead
exports.createLead = async (req, res) => {
  try {
    const { customar, title, description, status, expectedValue, assignedTo, remarks, source } =
      req.body;
    if (!customar) {
      return res.status(400).json({ message: "Name and email are required" });
    }
    const lead = await Lead.create({
      customar, // Customer ID
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
        .populate("customar", "name email phone")
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
      .populate("customar", "name email phone company");
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
      { new: true }
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

exports.totalLeads = async (req,res) => {
  try {
    const total = await Lead.countDocuments();
    res.json({ total });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
}