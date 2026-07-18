const Campaign = require("../models/Campaign");
const logActivity = require("../utils/logActivity");
const CampaignRecipient = require("../models/CampaignRecipient");
const Customer = require("../models/Customer");
const sendEmail = require("../utils/sendEmail");
const replaceVariables = require("../utils/replaceVariables");
const { Parser } = require("json2csv");

const ACTION_ONLY_STATUSES = ["running", "paused", "completed", "failed", "archived"];

const resolveRecipientEmail = async (recipient) => {
  if (recipient.recipientType === "Customer") {
    return { name: recipient.recipientId?.name, email: recipient.recipientId?.email };
  }
  const customer = await Customer.findById(recipient.recipientId?.customer).select("name email");
  return { name: customer?.name, email: customer?.email };
};

// Shared by startCampaign, resumeCampaign, and the scheduler poller — only
// ever touches "pending" recipients, so calling it again after a pause
// naturally continues where it left off.
const runCampaignSend = async (campaignId, actingUser) => {
  const campaign = await Campaign.findById(campaignId).populate("emailTemplate");
  const recipients = await CampaignRecipient.find({
    campaign: campaign._id,
    status: "pending",
  }).populate("recipientId");

  let sentCount = 0;

  for (const recipient of recipients) {
    const fresh = await Campaign.findById(campaignId).select("status");
    if (fresh.status === "paused") break;

    try {
      const { name, email } = await resolveRecipientEmail(recipient);
      if (!email) throw new Error("Recipient email not found");

      const variables = {
        name,
        email,
        sender_name: actingUser?.name || "",
        company_name: "CloudifyApps",
      };

      const subject = replaceVariables(campaign.emailTemplate.subject, variables);
      const body = replaceVariables(campaign.emailTemplate.body, variables);

      await sendEmail({ to: email, subject, html: body });

      recipient.status = "sent";
      recipient.sentAt = new Date();
      await recipient.save();
      sentCount += 1;
    } catch (err) {
      recipient.status = "failed";
      await recipient.save();
    }
  }

  const stillPaused = (await Campaign.findById(campaignId).select("status")).status === "paused";
  if (!stillPaused) {
    const totalAttempted = recipients.length;
    campaign.status = totalAttempted > 0 && sentCount === 0 ? "failed" : "completed";
    campaign.completedAt = new Date();
    await campaign.save();
  }

  return campaign;
};

// Create a new campaign
exports.createCampaign = async (req, res) => {
  try {
    const {
      name,
      type,
      customers = [],
      leads = [],
      emailTemplate,
      isScheduled,
      scheduledAt,
      tags,
      priority,
      goal,
      description,
    } = req.body;
    if (!name || !emailTemplate) {
      return res
        .status(400)
        .json({ message: "Name and Email Template are required" });
    }

    const hasFutureSchedule = isScheduled && scheduledAt && new Date(scheduledAt) > new Date();

    const campaign = await Campaign.create({
      name,
      description,
      type,
      customers,
      leads,
      emailTemplate,
      isScheduled,
      scheduledAt,
      tags,
      priority,
      goal,
      status: hasFutureSchedule ? "scheduled" : "draft",
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

const SORTABLE_FIELDS = ["name", "createdAt", "scheduledAt", "status"];

exports.getCampaigns = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 5;
    const skip = (page - 1) * limit;
    const {
      status,
      isScheduled,
      search,
      type,
      emailTemplate,
      createdBy,
      tags,
      audienceType,
      overdueOnly,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const filter = {
      isDeleted: false,
    };
    if (status) filter.status = status;
    if (isScheduled) filter.isScheduled = isScheduled === "true";
    if (type) filter.type = type;
    if (emailTemplate) filter.emailTemplate = emailTemplate;
    if (createdBy) filter.createdBy = createdBy;
    if (tags) {
      const tagArray = typeof tags === "string" ? tags.split(",") : tags;
      filter.tags = { $in: tagArray };
    }
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }
    if (overdueOnly === "true") {
      filter.status = "scheduled";
      filter.scheduledAt = { $lt: new Date() };
    }
    if (audienceType === "customers") {
      filter["customers.0"] = { $exists: true };
      filter["leads.0"] = { $exists: false };
    } else if (audienceType === "leads") {
      filter["leads.0"] = { $exists: true };
      filter["customers.0"] = { $exists: false };
    } else if (audienceType === "mixed") {
      filter["customers.0"] = { $exists: true };
      filter["leads.0"] = { $exists: true };
    } else if (audienceType === "empty") {
      filter["customers.0"] = { $exists: false };
      filter["leads.0"] = { $exists: false };
    }

    const sortField = SORTABLE_FIELDS.includes(sortBy) ? sortBy : "createdAt";
    const sortOptions = { [sortField]: sortOrder === "asc" ? 1 : -1 };

    const [campaigns, total] = await Promise.all([
      Campaign.find(filter)
        .populate("createdBy", "name email")
        .populate("emailTemplate", "name subject body")
        .sort(sortOptions)
        .skip(skip)
        .limit(limit),
      Campaign.countDocuments(filter),
    ]);

    const campaignIds = campaigns.map((c) => c._id);
    const sentCounts = await CampaignRecipient.aggregate([
      {
        $match: {
          campaign: { $in: campaignIds },
          status: { $in: ["sent", "opened", "clicked", "bounced", "unsubscribed"] },
        },
      },
      { $group: { _id: "$campaign", count: { $sum: 1 } } },
    ]);
    const sentCountMap = Object.fromEntries(sentCounts.map((row) => [row._id.toString(), row.count]));

    const campaignsWithCounts = campaigns.map((campaign) => ({
      ...campaign.toObject(),
      sentCount: sentCountMap[campaign._id.toString()] || 0,
    }));

    res.status(200).json({
      data: campaignsWithCounts,
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
    if (campaign.status === "running") {
      return res.status(400).json({ message: "Cannot delete a running campaign" });
    }
    campaign.isDeleted = true;
    await campaign.save();
    await logActivity({
      userId: req.user._id,
      action: "DELETED",
      module: "campaign",
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
      description,
      type,
      customers,
      leads,
      emailTemplate,
      isScheduled,
      scheduledAt,
      tags,
      priority,
      goal,
      status,
    } = req.body;

    if (status !== undefined && ACTION_ONLY_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `"${status}" can only be set via its dedicated action endpoint`,
      });
    }

    const existing = await Campaign.findById(id);
    if (!existing || existing.isDeleted) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    const update = {
      name,
      description,
      type,
      customers,
      leads,
      emailTemplate,
      isScheduled,
      scheduledAt,
      tags,
      priority,
      goal,
    };
    // Only re-derive draft⇄scheduled for campaigns that haven't started yet —
    // never downgrade a running/paused/completed/failed/archived campaign.
    if (isScheduled !== undefined && ["draft", "scheduled"].includes(existing.status)) {
      update.status = isScheduled && scheduledAt && new Date(scheduledAt) > new Date()
        ? "scheduled"
        : "draft";
    }

    const campaign = await Campaign.findByIdAndUpdate(id, update, { new: true });
    await logActivity({
      userId: req.user._id,
      action: "UPDATED",
      module: "campaign",
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
    const campaign = await Campaign.findById(id).populate("emailTemplate");
    if (!campaign || campaign.isDeleted) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    if (!campaign.emailTemplate?.subject || !campaign.emailTemplate?.body) {
      return res.status(400).json({
        message: "Email template subject or body is missing",
      });
    }

    if (!["draft", "scheduled", "paused"].includes(campaign.status)) {
      return res.status(400).json({ message: "Campaign cannot be started from its current status" });
    }

    campaign.status = "running";
    campaign.startedAt = campaign.startedAt || new Date();
    await campaign.save();

    const updated = await runCampaignSend(campaign._id, req.user);

    await logActivity({
      userId: req.user._id,
      action: "STARTED",
      module: "campaign",
      referenceId: campaign._id,
      description: `Started campaign: ${campaign.name}`,
    });

    res.status(200).json({ message: "Campaign started successfully", campaign: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /campaigns/:id/duplicate
exports.duplicateCampaign = async (req, res) => {
  try {
    const original = await Campaign.findById(req.params.id);
    if (!original || original.isDeleted) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    const copy = await Campaign.create({
      name: `${original.name} (Copy)`,
      description: original.description,
      type: original.type,
      customers: original.customers,
      leads: original.leads,
      emailTemplate: original.emailTemplate,
      tags: original.tags,
      priority: original.priority,
      goal: original.goal,
      status: "draft",
      isScheduled: false,
      createdBy: req.user._id,
    });

    const recipients = [
      ...copy.customers.map((customerId) => ({
        campaign: copy._id,
        recipientId: customerId,
        recipientType: "Customer",
        status: "pending",
      })),
      ...copy.leads.map((leadId) => ({
        campaign: copy._id,
        recipientId: leadId,
        recipientType: "Lead",
        status: "pending",
      })),
    ];
    if (recipients.length > 0) {
      await CampaignRecipient.insertMany(recipients);
    }

    await logActivity({
      userId: req.user._id,
      action: "DUPLICATED",
      module: "campaign",
      referenceId: copy._id,
      description: `Duplicated campaign: ${original.name}`,
    });

    res.status(201).json(copy);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /campaigns/:id/pause
exports.pauseCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign || campaign.isDeleted) {
      return res.status(404).json({ message: "Campaign not found" });
    }
    if (!["running", "scheduled"].includes(campaign.status)) {
      return res.status(400).json({ message: "Only running or scheduled campaigns can be paused" });
    }
    campaign.status = "paused";
    await campaign.save();
    await logActivity({
      userId: req.user._id,
      action: "PAUSED",
      module: "campaign",
      referenceId: campaign._id,
      description: `Paused campaign: ${campaign.name}`,
    });
    res.status(200).json({ message: "Campaign paused", campaign });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /campaigns/:id/resume
exports.resumeCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign || campaign.isDeleted) {
      return res.status(404).json({ message: "Campaign not found" });
    }
    if (campaign.status !== "paused") {
      return res.status(400).json({ message: "Only paused campaigns can be resumed" });
    }

    if (!campaign.startedAt && campaign.isScheduled && campaign.scheduledAt > new Date()) {
      campaign.status = "scheduled";
      await campaign.save();
      return res.status(200).json({ message: "Campaign rescheduled", campaign });
    }

    campaign.status = "running";
    await campaign.save();
    const updated = await runCampaignSend(campaign._id, req.user);

    await logActivity({
      userId: req.user._id,
      action: "RESUMED",
      module: "campaign",
      referenceId: campaign._id,
      description: `Resumed campaign: ${campaign.name}`,
    });

    res.status(200).json({ message: "Campaign resumed", campaign: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /campaigns/:id/archive
exports.archiveCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign || campaign.isDeleted) {
      return res.status(404).json({ message: "Campaign not found" });
    }
    if (campaign.status === "running") {
      return res.status(400).json({ message: "Pause the campaign before archiving it" });
    }
    campaign.status = "archived";
    await campaign.save();
    await logActivity({
      userId: req.user._id,
      action: "ARCHIVED",
      module: "campaign",
      referenceId: campaign._id,
      description: `Archived campaign: ${campaign.name}`,
    });
    res.status(200).json({ message: "Campaign archived", campaign });
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

// GET /campaigns/summary
exports.getCampaignSummary = async (req, res) => {
  try {
    const [statusRows, emailsSent] = await Promise.all([
      Campaign.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      CampaignRecipient.aggregate([
        {
          $lookup: {
            from: "campaigns",
            localField: "campaign",
            foreignField: "_id",
            as: "campaignDoc",
          },
        },
        { $match: { "campaignDoc.isDeleted": false, status: { $in: ["sent", "opened", "clicked", "bounced", "unsubscribed"] } } },
        { $count: "count" },
      ]),
    ]);

    const byStatus = Object.fromEntries(
      ["draft", "scheduled", "running", "paused", "completed", "failed", "archived"].map((s) => [s, 0])
    );
    let total = 0;
    statusRows.forEach((row) => {
      if (row._id in byStatus) byStatus[row._id] = row.count;
      total += row.count;
    });

    res.json({
      total,
      ...byStatus,
      emailsSent: emailsSent[0]?.count || 0,
      // Explicitly null (not 0) — the "not yet tracked" signal until Phase 3
      // ships the tracking-pixel/click-redirect infrastructure.
      openRate: null,
      clickRate: null,
      conversionRate: null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /campaigns/filter-options
exports.getCampaignFilterOptions = async (req, res) => {
  try {
    const tags = await Campaign.distinct("tags", { isDeleted: false });
    res.json({ tags });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /campaigns/export
exports.exportCampaignData = async (req, res) => {
  try {
    const { search, status, type, emailTemplate, createdBy, tags, ids } = req.query;

    const filter = { isDeleted: false };
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (emailTemplate) filter.emailTemplate = emailTemplate;
    if (createdBy) filter.createdBy = createdBy;
    if (tags) {
      const tagArray = typeof tags === "string" ? tags.split(",") : tags;
      filter.tags = { $in: tagArray };
    }
    if (ids) filter._id = { $in: ids.split(",") };
    if (search) filter.name = { $regex: search, $options: "i" };

    const campaigns = await Campaign.find(filter)
      .populate("createdBy", "name")
      .populate("emailTemplate", "name");

    const campaignIds = campaigns.map((c) => c._id);
    const sentCounts = await CampaignRecipient.aggregate([
      { $match: { campaign: { $in: campaignIds }, status: { $in: ["sent", "opened", "clicked", "bounced", "unsubscribed"] } } },
      { $group: { _id: "$campaign", count: { $sum: 1 } } },
    ]);
    const sentCountMap = Object.fromEntries(sentCounts.map((row) => [row._id.toString(), row.count]));

    const rows = campaigns.map((c) => ({
      name: c.name,
      type: c.type,
      status: c.status,
      priority: c.priority,
      goal: c.goal,
      tags: (c.tags || []).join("; "),
      emailTemplate: c.emailTemplate?.name,
      customersCount: c.customers.length,
      leadsCount: c.leads.length,
      scheduledAt: c.scheduledAt,
      startedAt: c.startedAt,
      completedAt: c.completedAt,
      emailsSent: sentCountMap[c._id.toString()] || 0,
      createdBy: c.createdBy?.name,
      createdAt: c.createdAt,
    }));

    const fields = [
      { label: "Name", value: "name" },
      { label: "Type", value: "type" },
      { label: "Status", value: "status" },
      { label: "Priority", value: "priority" },
      { label: "Goal", value: "goal" },
      { label: "Tags", value: "tags" },
      { label: "Email Template", value: "emailTemplate" },
      { label: "Customers Count", value: "customersCount" },
      { label: "Leads Count", value: "leadsCount" },
      { label: "Scheduled At", value: "scheduledAt" },
      { label: "Started At", value: "startedAt" },
      { label: "Completed At", value: "completedAt" },
      { label: "Emails Sent", value: "emailsSent" },
      { label: "Created By", value: "createdBy" },
      { label: "Created At", value: "createdAt" },
    ];
    const parser = new Parser({ fields });
    const csv = parser.parse(rows);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=campaigns.csv");
    res.status(200).send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /campaigns/bulk-pause  { ids }
exports.bulkPauseCampaigns = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "ids are required" });
    }
    const result = await Campaign.updateMany(
      { _id: { $in: ids }, isDeleted: false, status: { $in: ["running", "scheduled"] } },
      { $set: { status: "paused" } }
    );
    res.json({ message: `${result.modifiedCount} campaigns paused` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /campaigns/bulk-resume  { ids }
exports.bulkResumeCampaigns = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "ids are required" });
    }
    const campaigns = await Campaign.find({ _id: { $in: ids }, isDeleted: false, status: "paused" });
    for (const campaign of campaigns) {
      if (!campaign.startedAt && campaign.isScheduled && campaign.scheduledAt > new Date()) {
        campaign.status = "scheduled";
        await campaign.save();
      } else {
        campaign.status = "running";
        await campaign.save();
        await runCampaignSend(campaign._id, req.user);
      }
    }
    res.json({ message: `${campaigns.length} campaigns resumed` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /campaigns/bulk-archive  { ids }
exports.bulkArchiveCampaigns = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "ids are required" });
    }
    const result = await Campaign.updateMany(
      { _id: { $in: ids }, isDeleted: false, status: { $ne: "running" } },
      { $set: { status: "archived" } }
    );
    res.json({ message: `${result.modifiedCount} campaigns archived` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /campaigns/bulk-delete  { ids }
exports.bulkDeleteCampaigns = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "ids are required" });
    }
    const result = await Campaign.updateMany(
      { _id: { $in: ids }, isDeleted: false, status: { $ne: "running" } },
      { $set: { isDeleted: true } }
    );
    res.json({ message: `${result.modifiedCount} campaigns deleted` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.runCampaignSend = runCampaignSend;
