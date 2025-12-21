const mongoose = require("mongoose");
const FollowUp = require("../models/FollowUp");

// Create a new follow-up
exports.createFollowUp = async (req, res) => {
  try {
    const { customer, lead, assignedTo, type, followUpDate, followUpNotes } = req.body;
    if (!customer || !lead || !assignedTo || !type || !followUpDate || !followUpNotes) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const followUp = await FollowUp.create({
      customer,
      lead,
      assignedTo,
      type,
      followUpDate,
      followUpNotes,
      createdBy: req.user._id
    });
    res.status(201).json(followUp);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getFollowUps = async (req, res) => {
  try {
    const filter = { isDeleted: false };

    if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
    if (req.query.status) filter.status = req.query.status;

    const followUps = await FollowUp.find(filter)
      .populate("customer", "name email phone")
      .populate("lead", "status")
      .populate("assignedTo", "name email")
      .sort({ followUpDate: 1 });

    res.json(followUps);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getFollowUpById = async (req, res) => {
  try {
    const followUp = await FollowUp.findById(req.params.id);
    if (!followUp || followUp.isDeleted) {
      return res.status(404).json({ message: "Follow-up not found" });
    }
    res.json(followUp);
   } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateFollowUp = async (req, res) => {
  const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid follow-up ID" });
    }
    try {
        const followUp = await FollowUp.findByIdAndUpdate(id, req.body, { new: true });
        if (!followUp) {
            return res.status(404).json({ message: "Follow-up not found" });
        }
        res.json(followUp);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

// Soft delete a follow-up
exports.deleteFollowUp = async (req, res) => {
  const { id } = req.params;
  try {
    const followUp = await FollowUp.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
    if (!followUp) {
      return res.status(404).json({ message: "Follow-up not found" });
    }
    res.json({ message: "Follow-up deleted successfully" });
    } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getTodayFollowUps = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const followUps = await FollowUp.find({
      followUpDate: { $gte: startOfDay, $lte: endOfDay },
       status: "pending",
      isDeleted: false
    })
      .populate("customer", "name email phone")
      .populate("lead", "status")
      .populate("assignedTo", "name email");
    res.json(followUps);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getUpcommingFollowUps = async (req, res) => {
  try {
    const now = new Date();
    const followUps = await FollowUp.find({
      followUpDate: { $gt: now },
      status: "pending",
      isDeleted: false
    })
      .populate("customer", "name email phone")
      .populate("lead", "status")
      .populate("assignedTo", "name email");
    res.json(followUps);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getMissedFollowUps = async (req, res) => {
  try {
    const now = new Date();
    const followUps = await FollowUp.find({
      followUpDate: { $lt: now },
      status: "pending",
        isDeleted: false
    })
      .populate("customer", "name email phone")
      .populate("lead", "status")
      .populate("assignedTo", "name email");
    res.json(followUps);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * PUT /followup/:id/complete
 */
exports.completeFollowUp = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid follow-up ID" });
    }
    try {
        const followUp = await FollowUp.findByIdAndUpdate(id, { followUpStatus: "completed" }, { new: true });
        if (!followUp) {
            return res.status(404).json({ message: "Follow-up not found" });
        }
        res.json({ message: "Follow-up completed successfully", followUp });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

exports.rescheduleFollowUp = async (req, res) => {
    const { id } = req.params;
    const { newDate } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid follow-up ID" });
    }
    try {
        const followUp = await FollowUp.findByIdAndUpdate(id, { followUpDate: newDate }, { new: true });
        if (!followUp) {
            return res.status(404).json({ message: "Follow-up not found" });
        }
        res.json({ message: "Follow-up rescheduled successfully", followUp });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};