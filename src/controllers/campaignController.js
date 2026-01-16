const Campaign = require("../models/Campaign");
const logActivity = require("../utils/logActivity");
const CampaignRecipient = require("../models/CampaignRecipient");
const Customer = require("../models/Customer");
const sendEmail = require("../utils/sendEmail");
const replaceVariables = require("../utils/replaceVariables");

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
      .populate("emailTemplate", "name subject body");

    if (!campaign || campaign.isDeleted) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    let recipients = await CampaignRecipient.find({ campaign: id })
      .populate({
        path: "recipientId",
        select: "name email customer",
      })
      .lean();

    // 🔥 only populate customer for LEAD recipients
    for (let r of recipients) {
      if (r.recipientType === "Lead" && r.recipientId?.customer) {
        r.recipientId.customer = await Customer.findById(r.recipientId.customer)
          .select("name email")
          .lean();
      }
    }

    const formattedRecipients = recipients.map((r) => {
      if (r.recipientType === "Customer") {
        return {
          _id: r._id,
          name: r.recipientId?.name,
          email: r.recipientId?.email,
          recipientType: "customer",
          status: r.status,
        };
      }

      // Lead → use customer info
      return {
        _id: r._id,
        name: r.recipientId?.customer?.name,
        email: r.recipientId?.customer?.email,
        recipientType: "lead",
        status: r.status,
      };
    });

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
    const campaign = await Campaign.findById(id).populate(
      "emailTemplate"
    );
    if (!campaign || campaign.isDeleted) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    if (!campaign.emailTemplate?.subject || !campaign.emailTemplate?.body) {
      return res.status(400).json({
        message: "Email template subject or body is missing",
      });
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
        const user = recipient.recipientId;
        if (!user?.email) throw new Error("Recipient email not found");

        // 🔑 VARIABLE MAP (PER USER)
        const variables = {
          name: user.name,
          email: user.email,
          sender_name: req.user.name,
          company_name: "CloudifyApps",
        };

        // 🔁 REPLACE VARIABLES
        const subject = replaceVariables(
          campaign.emailTemplate.subject,
          variables
        );

        const body = replaceVariables(campaign.emailTemplate.body, variables);
        console.log("FINAL SUBJECT:", subject);
        console.log("FINAL BODY:", body);

        await sendEmail({
          to: user.email,
          subject: subject,
          html: body,
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

    campaign.status = "Completed";
    await campaign.save();
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
    console.log("req -", req.body);
    const { id } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Test email is required" });
    }

    const campaign = await Campaign.findById(id).populate("emailTemplate");
    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    await sendEmail({
      to: email,
      subject: campaign.emailTemplate.subject,
      html: campaign.emailTemplate.body,
    });

    await logActivity({
      userId: req.user._id,
      action: "TEST_EMAIL",
      module: "campaign",
      referenceId: campaign._id,
      description: `Sent test email to ${email}`,
    });

    res.status(200).json({ message: "Test email sent successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to send test email" });
  }
};
