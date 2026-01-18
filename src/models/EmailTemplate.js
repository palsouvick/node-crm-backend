const mongoose = require('mongoose');

const EmailTemplateSchema = new mongoose.Schema({
    name: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String, // HTML or plain text
      required: true,
    },
    // New CRM Features
    category: {
      type: String,
      enum: [
        'general',
        'welcome',
        'followup',
        'proposal',
        'reminder',
        'newsletter',
        'promotion',
        'feedback',
        'renewal',
        'abandoned'
      ],
      default: 'general',
    },
    preheader: {
      type: String, // Preview text shown in email inbox
      trim: true,
      maxlength: 150,
    },
    tags: [{
      type: String,
      trim: true,
    }],
    attachments: [{
      filename: {
        type: String,
        required: true,
      },
      fileUrl: {
        type: String, // URL to stored file (S3, Cloudinary, etc.)
        required: true,
      },
      fileSize: {
        type: Number, // Size in bytes
      },
      mimeType: {
        type: String,
      },
      uploadedAt: {
        type: Date,
        default: Date.now,
      }
    }],
    // Usage tracking
    usageCount: {
      type: Number,
      default: 0,
    },
    lastUsedAt: {
      type: Date,
    },
    // Template metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    // Optional: Template versioning
    version: {
      type: Number,
      default: 1,
    },
    // Optional: A/B testing
    variants: [{
      name: String,
      subject: String,
      body: String,
      usageCount: { type: Number, default: 0 },
      conversionRate: { type: Number, default: 0 },
    }],
}, {
  timestamps: true,
});

// Indexes for better query performance
EmailTemplateSchema.index({ name: 1, createdBy: 1 });
EmailTemplateSchema.index({ category: 1, isActive: 1 });
EmailTemplateSchema.index({ tags: 1 });
EmailTemplateSchema.index({ isDeleted: 1, isActive: 1 });

// Virtual for displaying usage statistics
EmailTemplateSchema.virtual('isPopular').get(function() {
  return this.usageCount > 10;
});

// Method to increment usage count
EmailTemplateSchema.methods.recordUsage = async function() {
  this.usageCount += 1;
  this.lastUsedAt = new Date();
  return this.save();
};

// Static method to find active templates
EmailTemplateSchema.statics.findActive = function(userId, category = null) {
  const query = {
    createdBy: userId,
    isActive: true,
    isDeleted: false,
  };
  
  if (category) {
    query.category = category;
  }
  
  return this.find(query).sort({ updatedAt: -1 });
};

// Static method to search templates
EmailTemplateSchema.statics.search = function(userId, searchTerm) {
  return this.find({
    createdBy: userId,
    isDeleted: false,
    $or: [
      { name: { $regex: searchTerm, $options: 'i' } },
      { subject: { $regex: searchTerm, $options: 'i' } },
      { tags: { $regex: searchTerm, $options: 'i' } },
    ]
  }).sort({ updatedAt: -1 });
};

// Pre-save middleware to handle versioning
EmailTemplateSchema.pre('save', function(next) {
  if (this.isModified('body') || this.isModified('subject')) {
    this.version += 1;
  }
});

module.exports = mongoose.model('EmailTemplate', EmailTemplateSchema);