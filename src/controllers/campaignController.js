const Campaign = require("../models/Campaign");
const logActivity = require("../utils/logActivity");
const CampaignRecipient = require("../models/CampaignRecipient");
// Create a new campaign
exports.createCampaign = async (req, res) => {
  try {
    const {
      name,
      subject,
      body,
      type,
      customers = [],
      leads = [],
      emailTemplate,
      isScheduled,
      scheduledAt,
    } = req.body;
    if (!name || !emailTemplate) {
      return res
        .status(400)
        .json({ message: "Name and Email Template are required" });
    }
    const campaign = await Campaign.create({
      name,
      subject,
      body,
      type,
      customers,
      leads,
      emailTemplate,
      isScheduled,
      scheduledAt,
      createdBy: req.user._id,
    });
    // 2️⃣ Prepare recipients (CRM standard)
    const recipients = [];

    customers.forEach((customerId) => {
      recipients.push({
        campaign: campaign._id,
        recipientId: customerId,
        recipientType: "Customer",
        status: "pending",
      });
    });

    leads.forEach((leadId) => {
      recipients.push({
        campaign: campaign._id,
        recipientId: leadId,
        recipientType: "Lead",
        status: "pending",
      });
    });

    // 3️⃣ Insert recipients
    if (recipients.length > 0) {
      await CampaignRecipient.insertMany(recipients);
    }
    res.status(201).json(campaign);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getCampaigns = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 5;
    const skip = (page - 1) * limit;
    const { status, isScheduled, search } = req.query;

    const filter = {
      isDeleted: false,
    };
    // Status filter
    if (status) {
      filter.status = status;
    }
    // isScheduled filter
    if (isScheduled) {
      filter.isScheduled = isScheduled === "true";
    }
    // Search filter
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }
    const campaigns = await Campaign.find(filter)
      .populate("createdBy", "name email")
      .populate("emailTemplate", "name subject body")
      .skip(skip)
      .limit(limit);
    const total = await Campaign.countDocuments(filter);
    res.status(200).json({
      data: campaigns,
      pagenation: {
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

exports.getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id)
      .populate("createdBy", "name email")
      .populate("customers", "name email")
      .populate("leads", "name email")
      .populate("emailTemplate", "name subject body");

    if (!campaign || campaign.isDeleted) {
      return res.status(404).json({ message: "Campaign not found" });
    }
    
    let recipients = await CampaignRecipient.find({ campaign: id })
      .populate("recipientId")
      .lean();

    // populate Lead → Customer safely
    await CampaignRecipient.populate(recipients, {
      path: "recipientId.customar",
      select: "name email",
    });

    const formattedRecipients = recipients.map((r) => ({
      _id: r._id,
      name:
        r.recipientType === "Customer"
          ? r.recipientId?.name
          : r.recipientId?.customar?.name,
      email:
        r.recipientType === "Customer"
          ? r.recipientId?.email
          : r.recipientId?.customar?.email,
      recipientType: r.recipientType.toLowerCase(),
      status: r.status,
    }));

    // Stats
    const stats = await CampaignRecipient.aggregate([
      { $match: { campaign: campaign._id } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const summary = stats.reduce((acc, s) => {
      acc[s._id] = s.count;
      return acc;
    }, {});

    res.status(200).json({
      campaign,
      recipients: formattedRecipients,
      stats: {
        total: recipients.length,
        pending: summary.pending || 0,
        sent: summary.sent || 0,
        opened: summary.opened || 0,
        clicked: summary.clicked || 0,
        failed: summary.failed || 0,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete a campaign (soft delete)
exports.deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id);
    if (!campaign || campaign.isDeleted) {
      return res.status(404).json({ message: "Campaign not found" });
    }
    campaign.isDeleted = true;
    await campaign.save();
    await logActivity({
      userId: req.user._id,
      action: "DELETED",
      module: "customer",
      referenceId: campaign._id,
      description: `Deleted campaign: ${campaign.name}`,
    });
    res.status(200).json({ message: "Campaign deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

//update a campaign
exports.updateCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      subject,
      body,
      type,
      customers,
      leads,
      emailTemplate,
      isScheduled,
      scheduledAt,
    } = req.body;
    const campaign = await Campaign.findByIdAndUpdate(
      id,
      {
        name,
        subject,
        body,
        type,
        customers,
        leads,
        emailTemplate,
        isScheduled,
        scheduledAt,
      },
      { new: true }
    );
    if (!campaign || campaign.isDeleted) {
      return res.status(404).json({ message: "Campaign not found" });
    }
    await logActivity({
      userId: req.user._id,
      action: "UPDATED",
      module: "customer",
      referenceId: campaign._id,
      description: `Updated campaign: ${campaign.name}`,
    });
    res.status(200).json(campaign);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

//campaign start
exports.startCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id);
    if (!campaign || campaign.isDeleted) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    if (campaign.status === "running") {
      return res.status(400).json({ message: "Campaign already running" });
    }
    campaign.status = "running";
    campaign.startedAt = new Date();
    await campaign.save();

    // Fetch recipients
    const recipients = await CampaignRecipient.find({
      campaign: campaign._id,
      status: "pending",
    }).populate("recipientId");

    for (const recipient of recipients) {
      try {
        const email = await getRecipientEmail(recipient);
        if (!email) throw new Error("Email not found");

        await sendEmail({
          to: email,
          subject: campaign.emailTemplate.subject,
          html: campaign.emailTemplate.body,
        });

        recipient.status = "sent";
        recipient.sentAt = new Date();
        await recipient.save();
      } catch (err) {
        recipient.status = "failed";
        await recipient.save();
      }
    }

    await logActivity({
      userId: req.user._id,
      action: "STARTED",
      module: "campaign",
      referenceId: campaign._id,
      description: `Started campaign: ${campaign.name}`,
    });
    
    res
      .status(200)
      .json({ message: "Campaign started successfully", campaign });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.sendTestEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { testEmail } = req.body;

    if (!testEmail) {
      return res.status(400).json({ message: "Test email is required" });
    }

    const campaign = await Campaign.findById(id).populate("emailTemplate");
    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    await sendEmail({
      to: testEmail,
      subject: campaign.emailTemplate.subject,
      html: campaign.emailTemplate.body,
    });

    await logActivity({
      userId: req.user._id,
      action: "TEST_EMAIL",
      module: "campaign",
      referenceId: campaign._id,
      description: `Sent test email to ${testEmail}`,
    });

    res.status(200).json({ message: "Test email sent successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to send test email" });
  }
};

