const mongoose = require("mongoose");

const CompanySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    phone: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },

    address: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },

    industry: {
      type: String,
      enum: [
        "Technology",
        "Finance",
        "Healthcare",
        "Education",
        "Retail",
        "Manufacturing",
        "Real Estate",
        "Consulting",
        "Marketing",
        "Legal",
        "Other",
      ],
    },
    companySize: {
      type: String,
      enum: ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"],
    },

    description: {
      type: String,
      maxlength: 1000,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],

    status: {
      type: String,
      enum: ["active", "inactive", "lead", "customer", "prospect"],
      default: "active",
    },
    type: {
      type: String,
      enum: ["client", "vendor", "partner", "competitor", "other"],
      default: "client",
    },

    primaryContact: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
    },
    contacts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Contact",
      },
    ],

    socialMedia: {
      linkedin: String,
      twitter: String,
      facebook: String,
    },

    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    logo: {
      url: String,
      publicId: String,
    },

    lastContactedAt: {
      type: Date,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for better query performance
CompanySchema.index({ name: 1, owner: 1 });
CompanySchema.index({ email: 1 });
CompanySchema.index({ status: 1, isDeleted: 1 });
CompanySchema.index({ tags: 1 });
CompanySchema.index({ createdAt: -1 });

// Virtual for total contacts
CompanySchema.virtual("totalContacts", {
  ref: "Contact",
  localField: "_id",
  foreignField: "company",
  count: true,
});

// Virtual for deals
CompanySchema.virtual("deals", {
  ref: "Deal",
  localField: "_id",
  foreignField: "company",
});

// Static method to search companies
CompanySchema.statics.search = function (userId, searchTerm, filters = {}) {
  const query = {
    owner: userId,
    isDeleted: false,
  };

  if (searchTerm) {
    query.$or = [
      { name: { $regex: searchTerm, $options: "i" } },
      { email: { $regex: searchTerm, $options: "i" } },
      { phone: { $regex: searchTerm, $options: "i" } },
      { tags: { $regex: searchTerm, $options: "i" } },
    ];
  }

  if (filters.status) query.status = filters.status;
  if (filters.type) query.type = filters.type;
  if (filters.industry) query.industry = filters.industry;

  return this.find(query).sort({ updatedAt: -1 });
};

// Method to soft delete
CompanySchema.methods.softDelete = async function (userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  return this.save();
};

module.exports = mongoose.model("Company", CompanySchema);