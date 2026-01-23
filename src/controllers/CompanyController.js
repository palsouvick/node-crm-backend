const Company = require("../models/Company");
const multer = require("multer");
const path = require("path");

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

      // Check for duplicate company name for this user
      const existingCompany = await Company.findOne({
        name: { $regex: new RegExp(`^${name}$`, "i") },
        owner: req.user._id,
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
      sortBy = "updatedAt",
      sortOrder = "desc",
      page = 1,
      limit = 10,
    } = req.query;

    const query = {
      isDeleted: false,
    };
console.log("Search term:", search);
    // Search
    if (search) {
      console.log("Search term:", search);
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
    if (tags) {
      const tagArray = typeof tags === "string" ? tags.split(",") : tags;
      query.tags = { $in: tagArray };
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
    console.log(companies);
    res.status(200).json({
      success: true,
      data: companies,
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
        owner: req.user._id,
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

// GET Company Statistics
exports.getCompanyStats = async (req, res) => {
  try {
    const stats = await Company.aggregate([
      {
        $match: {
          owner: req.user._id,
          isDeleted: false,
        },
      },
      {
        $facet: {
          byStatus: [
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
              },
            },
          ],
          byType: [
            {
              $group: {
                _id: "$type",
                count: { $sum: 1 },
              },
            },
          ],
          byIndustry: [
            {
              $group: {
                _id: "$industry",
                count: { $sum: 1 },
              },
            },
          ],
          bySize: [
            {
              $group: {
                _id: "$companySize",
                count: { $sum: 1 },
              },
            },
          ],
          totalRevenue: [
            {
              $group: {
                _id: null,
                total: { $sum: "$annualRevenue" },
                average: { $avg: "$annualRevenue" },
              },
            },
          ],
        },
      },
    ]);

    const total = await Company.countDocuments({
      owner: req.user._id,
      isDeleted: false,
    });

    res.status(200).json({
      success: true,
      data: {
        total,
        ...stats[0],
      },
    });
  } catch (error) {
    console.error("Get company stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

module.exports = exports;
