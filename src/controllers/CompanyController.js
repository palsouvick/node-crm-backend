const Company = require("../models/Company");
const Customer = require("../models/Customer");
const Lead = require("../models/Lead");
const multer = require("multer");
const path = require("path");
const { Parser } = require("json2csv");

const OPEN_LEAD_STATUSES = { $nin: ["won", "lost"] };

// Configure multer for logo upload
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = "uploads/company-logos";
    const fs = require("fs").promises;
    await fs.mkdir(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "logo-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
}).single("logo");

// CREATE Company
exports.createCompany = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: "File upload error",
          error: err.message,
        });
      }

      const {
        name,
        email,
        phone,
        website,
        address,
        state,
        country,
        industry,
        companySize,
        description,
        tags,
        status,
        type,
        socialMedia,
        primaryContact,
        assignedTo,
        customFields,
        nextFollowUpDate,
      } = req.body;

      // Validation
      if (!name) {
        return res.status(400).json({
          success: false,
          message: "Company name is required",
        });
      }

      // Check for duplicate company name
      const existingCompany = await Company.findOne({
        name: { $regex: new RegExp(`^${name}$`, "i") },
        isDeleted: false,
      });

      if (existingCompany) {
        return res.status(400).json({
          success: false,
          message: "A company with this name already exists",
        });
      }

      // Prepare company data
      const companyData = {
        name,
        email,
        phone,
        website,
        address,
        state,
        country,
        industry,
        companySize,
        description,
        tags: typeof tags === "string" ? JSON.parse(tags) : tags || [],
        status: status || "active",
        type: type || "client",
        socialMedia:
          typeof socialMedia === "string"
            ? JSON.parse(socialMedia)
            : socialMedia,
        primaryContact,
        assignedTo:
          typeof assignedTo === "string"
            ? JSON.parse(assignedTo)
            : assignedTo || [],
        nextFollowUpDate,
      };

      // Add logo if uploaded
      if (req.file) {
        companyData.logo = {
          url: `/uploads/company-logos/${req.file.filename}`,
          publicId: req.file.filename,
        };
      }

      const company = await Company.create(companyData);

      // Populate references
      await company.populate([
        { path: "assignedTo", select: "name email" },
      ]);

      res.status(201).json({
        success: true,
        message: "Company created successfully",
        data: company,
      });
    });
  } catch (error) {
    console.error("Create company error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// GET All Companies with Filtering, Sorting, and Pagination
exports.getCompanies = async (req, res) => {
  try {
    const {
      search,
      status,
      type,
      industry,
      companySize,
      tags,
      country,
      state,
      assignedTo,
      dateFrom,
      dateTo,
      sortBy = "updatedAt",
      sortOrder = "desc",
      page = 1,
      limit = 10,
    } = req.query;

    const query = {
      isDeleted: false,
    };

    // Search
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Filters
    if (status) query.status = status;
    if (type) query.type = type;
    if (industry) query.industry = industry;
    if (companySize) query.companySize = companySize;
    if (country) query.country = country;
    if (state) query.state = state;
    if (assignedTo) query.assignedTo = assignedTo;
    if (tags) {
      const tagArray = typeof tags === "string" ? tags.split(",") : tags;
      query.tags = { $in: tagArray };
    }
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    // Sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

    const skip = (page - 1) * limit;

    const [companies, total] = await Promise.all([
      Company.find(query)
        .populate("assignedTo", "name email")
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      Company.countDocuments(query),
    ]);

    const companyIds = companies.map((c) => c._id);
    const linkedCustomers = await Customer.find({
      isDeleted: false,
      companyRef: { $in: companyIds },
    }).select("_id companyRef");

    const customerToCompany = Object.fromEntries(
      linkedCustomers.map((c) => [c._id.toString(), c.companyRef.toString()])
    );
    const linkedCustomerIds = linkedCustomers.map((c) => c._id);

    const openLeadCounts = await Lead.aggregate([
      { $match: { isDeleted: false, status: OPEN_LEAD_STATUSES, customer: { $in: linkedCustomerIds } } },
      { $group: { _id: "$customer", count: { $sum: 1 } } },
    ]);

    const openLeadsByCompany = {};
    openLeadCounts.forEach((row) => {
      const companyId = customerToCompany[row._id.toString()];
      if (!companyId) return;
      openLeadsByCompany[companyId] = (openLeadsByCompany[companyId] || 0) + row.count;
    });

    const companiesWithCounts = companies.map((company) => ({
      ...company.toObject(),
      openLeadsCount: openLeadsByCompany[company._id.toString()] || 0,
    }));

    res.status(200).json({
      success: true,
      data: companiesWithCounts,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get companies error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// GET Single Company
exports.getCompanyById = async (req, res) => {
  try {
    const company = await Company.findOne({
      _id: req.params.id,
      isDeleted: false,
    })
      .populate("assignedTo", "name email");

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    res.status(200).json({
      success: true,
      data: company,
    });
  } catch (error) {
    console.error("Get company error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// UPDATE Company
exports.updateCompany = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: "File upload error",
          error: err.message,
        });
      }

      const company = await Company.findOne({
        _id: req.params.id,
        isDeleted: false,
      });

      if (!company) {
        return res.status(404).json({
          success: false,
          message: "Company not found",
        });
      }

      const {
        name,
        email,
        phone,
        website,
        address,
        country,
        state,
        industry,
        companySize,
        description,
        tags,
        status,
        type,
        socialMedia,
        assignedTo,
        nextFollowUpDate,
        lastContactedAt,
      } = req.body;

      // Update fields
      if (name) company.name = name;
      if (email !== undefined) company.email = email;
      if (phone !== undefined) company.phone = phone;
      if (website !== undefined) company.website = website;
      if (address) company.address = address;
      if (industry) company.industry = industry;
      if (companySize) company.companySize = companySize;
      if (description !== undefined) company.description = description;
      if (tags)
        company.tags = typeof tags === "string" ? JSON.parse(tags) : tags;
      if (status) company.status = status;
      if (type) company.type = type;
      if (socialMedia)
        company.socialMedia =
          typeof socialMedia === "string"
            ? JSON.parse(socialMedia)
            : socialMedia;
      if (assignedTo)
        company.assignedTo =
          typeof assignedTo === "string" ? JSON.parse(assignedTo) : assignedTo;
      if(country) company.country = country;
      if(state) company.state = state;
      if (lastContactedAt) company.lastContactedAt = lastContactedAt;

      // Update logo if new file uploaded
      if (req.file) {
        company.logo = {
          url: `/uploads/company-logos/${req.file.filename}`,
          publicId: req.file.filename,
        };
      }

      await company.save();

      await company.populate([
        { path: "assignedTo", select: "name email" },
      ]);

      res.status(200).json({
        success: true,
        message: "Company updated successfully",
        data: company,
      });
    });
  } catch (error) {
    console.error("Update company error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// DELETE Company (Soft Delete)
exports.deleteCompany = async (req, res) => {
  try {
    const company = await Company.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    await Company.softDelete(req.params.id, req.user._id);

    res.status(200).json({
      success: true,
      message: "Company deleted successfully",
    });
  } catch (error) {
    console.error("Delete company error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// BULK DELETE Companies
exports.bulkDeleteCompanies = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of company IDs",
      });
    }

    const result = await Company.updateMany(
      {
        _id: { $in: ids },
        isDeleted: false,
      },
      {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: req.user._id,
      },
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} companies deleted successfully`,
      deletedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Bulk delete companies error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// GET /company/summary
exports.getCompanySummary = async (req, res) => {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [total, active, prospect, inactive, newThisMonth, openDealRows] = await Promise.all([
      Company.countDocuments({ isDeleted: false }),
      Company.countDocuments({ isDeleted: false, status: "active" }),
      Company.countDocuments({ isDeleted: false, status: "prospect" }),
      Company.countDocuments({ isDeleted: false, status: "inactive" }),
      Company.countDocuments({ isDeleted: false, createdAt: { $gte: startOfMonth } }),
      Customer.aggregate([
        { $match: { isDeleted: false, companyRef: { $ne: null } } },
        {
          $lookup: {
            from: "leads",
            let: { custId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$customer", "$$custId"] },
                  isDeleted: false,
                  status: OPEN_LEAD_STATUSES,
                },
              },
              { $limit: 1 },
            ],
            as: "openLeads",
          },
        },
        { $match: { "openLeads.0": { $exists: true } } },
        { $group: { _id: "$companyRef" } },
        { $count: "count" },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        total,
        active,
        prospect,
        inactive,
        newThisMonth,
        companiesWithOpenDeals: openDealRows[0]?.count || 0,
      },
    });
  } catch (error) {
    console.error("Get company summary error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

// GET /company/filter-options
exports.getCompanyFilterOptions = async (req, res) => {
  try {
    const [countries, states, tags] = await Promise.all([
      Company.distinct("country", { isDeleted: false, country: { $nin: [null, ""] } }),
      Company.distinct("state", { isDeleted: false, state: { $nin: [null, ""] } }),
      Company.distinct("tags", { isDeleted: false }),
    ]);
    res.json({ success: true, data: { countries, states, tags } });
  } catch (error) {
    console.error("Get company filter options error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

// GET /company/export
exports.exportCompanyData = async (req, res) => {
  try {
    const { search, status, type, industry, companySize, country, state, tags, dateFrom, dateTo, ids } =
      req.query;

    const query = { isDeleted: false };
    if (status) query.status = status;
    if (type) query.type = type;
    if (industry) query.industry = industry;
    if (companySize) query.companySize = companySize;
    if (country) query.country = country;
    if (state) query.state = state;
    if (tags) {
      const tagArray = typeof tags === "string" ? tags.split(",") : tags;
      query.tags = { $in: tagArray };
    }
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }
    if (ids) query._id = { $in: ids.split(",") };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const companies = await Company.find(query).populate("assignedTo", "name");
    const rows = companies.map((c) => ({
      name: c.name,
      email: c.email,
      phone: c.phone,
      website: c.website,
      industry: c.industry,
      companySize: c.companySize,
      annualRevenue: c.annualRevenue,
      state: c.state,
      country: c.country,
      status: c.status,
      type: c.type,
      assignedOwners: c.assignedTo.map((u) => u.name).join("; "),
      tags: c.tags.join("; "),
      createdAt: c.createdAt,
    }));

    const fields = [
      { label: "Name", value: "name" },
      { label: "Email", value: "email" },
      { label: "Phone", value: "phone" },
      { label: "Website", value: "website" },
      { label: "Industry", value: "industry" },
      { label: "Company Size", value: "companySize" },
      { label: "Annual Revenue", value: "annualRevenue" },
      { label: "State", value: "state" },
      { label: "Country", value: "country" },
      { label: "Status", value: "status" },
      { label: "Type", value: "type" },
      { label: "Assigned Owners", value: "assignedOwners" },
      { label: "Tags", value: "tags" },
      { label: "Created At", value: "createdAt" },
    ];
    const parser = new Parser({ fields });
    const csv = parser.parse(rows);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=companies.csv");
    res.status(200).send(csv);
  } catch (error) {
    console.error("Export company data error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

// POST /company/bulk-status  { ids, status }
exports.bulkUpdateCompanyStatus = async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || !status) {
      return res.status(400).json({ success: false, message: "ids and status are required" });
    }
    await Company.updateMany({ _id: { $in: ids }, isDeleted: false }, { $set: { status } });
    res.json({ success: true, message: "Companies updated successfully" });
  } catch (error) {
    console.error("Bulk update company status error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

// POST /company/bulk-assign-owner  { ids, ownerIds }
exports.bulkAssignCompanyOwner = async (req, res) => {
  try {
    const { ids, ownerIds } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || !Array.isArray(ownerIds)) {
      return res.status(400).json({ success: false, message: "ids and ownerIds are required" });
    }
    await Company.updateMany(
      { _id: { $in: ids }, isDeleted: false },
      { $set: { assignedTo: ownerIds } }
    );
    res.json({ success: true, message: "Owners assigned successfully" });
  } catch (error) {
    console.error("Bulk assign company owner error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

module.exports = exports;
