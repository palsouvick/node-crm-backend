const EmailTemplate = require("../models/EmailTemplate");

exports.createEmailTemplate = async (req, res) => {
  try {
    const { name, subject, body } = req.body;
    if (!name || !subject || !body) {
      return res
        .status(400)
        .json({ message: "Name, subject, and body are required" });
    }
    const emailTemplate = await EmailTemplate.create({
      name,
      subject,
      body,
      createdBy: req.user._id,
    });
    res.status(201).json(emailTemplate);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

exports.getEmailTemplates = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = Number(req.query.skip) || 0;
    const { search } = req.query;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
      ];
    }

    const emailTemplates = await EmailTemplate.find({
      isActive: true,
      isDeleted: false,
    })
      .populate("createdBy", "name email")
      .skip(skip)
      .limit(limit);
    res.status(200).json({
      data: emailTemplates,
      pagenation: {
        page,
        limit,
        total: await EmailTemplate.countDocuments({
          isActive: true,
          isDeleted: false,
        }),
        totalPages: Math.ceil(
          (await EmailTemplate.countDocuments({
            isActive: true,
            isDeleted: false,
          })) / limit
        ),
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

exports.updateEmailTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, subject, body } = req.body;
    const emailTemplate = await EmailTemplate.findById(id);
    if (!emailTemplate) {
      return res.status(404).json({ message: "Email Template not found" });
    }
    emailTemplate.name = name || emailTemplate.name;
    emailTemplate.subject = subject || emailTemplate.subject;
    emailTemplate.body = body || emailTemplate.body;
    await emailTemplate.save();
    res.status(200).json(emailTemplate);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

exports.deleteEmailTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const emailTemplate = await EmailTemplate.findById(id);
    if (!emailTemplate) {
      return res.status(404).json({ message: "Email Template not found" });
    }
    emailTemplate.isActive = false;
    emailTemplate.isDeleted = true;
    await emailTemplate.save();
    res.status(200).json({ message: "Email Template deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

exports.getEmailTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const emailTemplate = await EmailTemplate.findById(id).populate(
      "createdBy",
      "name email"
    );
    if (!emailTemplate || !emailTemplate.isActive) {
      return res.status(404).json({ message: "Email Template not found" });
    }
    res.status(200).json(emailTemplate);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
