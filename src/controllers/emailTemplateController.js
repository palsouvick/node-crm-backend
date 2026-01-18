const EmailTemplate = require('../models/EmailTemplate');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = 'uploads/email-attachments';
    await fs.mkdir(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images, PDFs, and documents are allowed'));
    }
  }
}).array('attachments', 5); // Max 5 files

// CREATE Email Template
exports.createEmailTemplate = async (req, res) => {
  try {
    // Handle file upload
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ 
          message: 'File upload error', 
          error: err.message 
        });
      }

      const { name, subject, body, category, preheader, tags } = req.body;

      // Validation
      if (!name || !subject || !body) {
        return res.status(400).json({ 
          message: "Name, subject, and body are required" 
        });
      }

      // Process attachments
      const attachments = [];
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          attachments.push({
            filename: file.originalname,
            fileUrl: `/uploads/email-attachments/${file.filename}`, // or S3 URL
            fileSize: file.size,
            mimeType: file.mimetype,
          });
        }
      }

      // Parse tags if sent as JSON string
      let parsedTags = [];
      if (tags) {
        parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
      }

      // Create email template
      const emailTemplate = await EmailTemplate.create({
        name,
        subject,
        body,
        category: category || 'general',
        preheader: preheader || '',
        tags: parsedTags,
        attachments,
        createdBy: req.user._id,
      });

      res.status(201).json({
        success: true,
        message: 'Email template created successfully',
        data: emailTemplate
      });
    });
  } catch (error) {
    console.error('Create email template error:', error);
    res.status(500).json({ 
      success: false,
      message: "Server Error", 
      error: error.message 
    });
  }
};

// GET All Email Templates
exports.getEmailTemplates = async (req, res) => {
  try {
    const { category, search, tags, page = 1, limit = 10 } = req.query;
    
    const query = {
      createdBy: req.user._id,
      isDeleted: false,
    };

    // Filter by category
    if (category && category !== 'all') {
      query.category = category;
    }

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    // Filter by tags
    if (tags) {
      const tagArray = typeof tags === 'string' ? tags.split(',') : tags;
      query.tags = { $in: tagArray };
    }

    const skip = (page - 1) * limit;
    
    const [templates, total] = await Promise.all([
      EmailTemplate.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-__v'),
      EmailTemplate.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: templates,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit),
      }
    });
  } catch (error) {
    console.error('Get email templates error:', error);
    res.status(500).json({ 
      success: false,
      message: "Server Error", 
      error: error.message 
    });
  }
};

// GET Single Email Template
exports.getEmailTemplateById = async (req, res) => {
  try {
    const template = await EmailTemplate.findOne({
      _id: req.params.id,
      createdBy: req.user._id,
      isDeleted: false,
    });

    if (!template) {
      return res.status(404).json({ 
        success: false,
        message: 'Email template not found' 
      });
    }

    res.status(200).json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Get email template error:', error);
    res.status(500).json({ 
      success: false,
      message: "Server Error", 
      error: error.message 
    });
  }
};

// UPDATE Email Template
exports.updateEmailTemplate = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ 
          message: 'File upload error', 
          error: err.message 
        });
      }

      const { name, subject, body, category, preheader, tags, existingAttachments } = req.body;

      const template = await EmailTemplate.findOne({
        _id: req.params.id,
        createdBy: req.user._id,
        isDeleted: false,
      });

      if (!template) {
        return res.status(404).json({ 
          success: false,
          message: 'Email template not found' 
        });
      }

      // Update fields
      if (name) template.name = name;
      if (subject) template.subject = subject;
      if (body) template.body = body;
      if (category) template.category = category;
      if (preheader !== undefined) template.preheader = preheader;
      
      // Update tags
      if (tags) {
        template.tags = typeof tags === 'string' ? JSON.parse(tags) : tags;
      }

      // Handle attachments
      let attachments = [];
      
      // Keep existing attachments
      if (existingAttachments) {
        const existing = typeof existingAttachments === 'string' 
          ? JSON.parse(existingAttachments) 
          : existingAttachments;
        attachments = [...existing];
      }

      // Add new attachments
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          attachments.push({
            filename: file.originalname,
            fileUrl: `/uploads/email-attachments/${file.filename}`,
            fileSize: file.size,
            mimeType: file.mimetype,
          });
        }
      }

      template.attachments = attachments;
      template.updatedBy = req.user._id;

      await template.save();

      res.status(200).json({
        success: true,
        message: 'Email template updated successfully',
        data: template
      });
    });
  } catch (error) {
    console.error('Update email template error:', error);
    res.status(500).json({ 
      success: false,
      message: "Server Error", 
      error: error.message 
    });
  }
};

// DELETE Email Template (Soft Delete)
exports.deleteEmailTemplate = async (req, res) => {
  try {
    const template = await EmailTemplate.findOneAndUpdate(
      {
        _id: req.params.id,
        createdBy: req.user._id,
        isDeleted: false,
      },
      {
        isDeleted: true,
        isActive: false,
      },
      { new: true }
    );

    if (!template) {
      return res.status(404).json({ 
        success: false,
        message: 'Email template not found' 
      });
    }

    res.status(200).json({
      success: true,
      message: 'Email template deleted successfully'
    });
  } catch (error) {
    console.error('Delete email template error:', error);
    res.status(500).json({ 
      success: false,
      message: "Server Error", 
      error: error.message 
    });
  }
};

// TOGGLE Active Status
exports.toggleActiveStatus = async (req, res) => {
  try {
    const template = await EmailTemplate.findOne({
      _id: req.params.id,
      createdBy: req.user._id,
      isDeleted: false,
    });

    if (!template) {
      return res.status(404).json({ 
        success: false,
        message: 'Email template not found' 
      });
    }

    template.isActive = !template.isActive;
    await template.save();

    res.status(200).json({
      success: true,
      message: `Email template ${template.isActive ? 'activated' : 'deactivated'} successfully`,
      data: template
    });
  } catch (error) {
    console.error('Toggle active status error:', error);
    res.status(500).json({ 
      success: false,
      message: "Server Error", 
      error: error.message 
    });
  }
};

// DUPLICATE Email Template
exports.duplicateEmailTemplate = async (req, res) => {
  try {
    const original = await EmailTemplate.findOne({
      _id: req.params.id,
      createdBy: req.user._id,
      isDeleted: false,
    });

    if (!original) {
      return res.status(404).json({ 
        success: false,
        message: 'Email template not found' 
      });
    }

    const duplicate = await EmailTemplate.create({
      name: `${original.name} (Copy)`,
      subject: original.subject,
      body: original.body,
      category: original.category,
      preheader: original.preheader,
      tags: original.tags,
      attachments: original.attachments,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: 'Email template duplicated successfully',
      data: duplicate
    });
  } catch (error) {
    console.error('Duplicate email template error:', error);
    res.status(500).json({ 
      success: false,
      message: "Server Error", 
      error: error.message 
    });
  }
};

// RECORD Template Usage
exports.recordTemplateUsage = async (req, res) => {
  try {
    const template = await EmailTemplate.findOne({
      _id: req.params.id,
      createdBy: req.user._id,
      isDeleted: false,
    });

    if (!template) {
      return res.status(404).json({ 
        success: false,
        message: 'Email template not found' 
      });
    }

    await template.recordUsage();

    res.status(200).json({
      success: true,
      message: 'Template usage recorded',
      data: {
        usageCount: template.usageCount,
        lastUsedAt: template.lastUsedAt
      }
    });
  } catch (error) {
    console.error('Record template usage error:', error);
    res.status(500).json({ 
      success: false,
      message: "Server Error", 
      error: error.message 
    });
  }
};

// GET Template Statistics
exports.getTemplateStats = async (req, res) => {
  try {
    const stats = await EmailTemplate.aggregate([
      {
        $match: {
          createdBy: req.user._id,
          isDeleted: false,
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalUsage: { $sum: '$usageCount' },
          avgUsage: { $avg: '$usageCount' },
        }
      }
    ]);

    const total = await EmailTemplate.countDocuments({
      createdBy: req.user._id,
      isDeleted: false,
    });

    const active = await EmailTemplate.countDocuments({
      createdBy: req.user._id,
      isDeleted: false,
      isActive: true,
    });

    res.status(200).json({
      success: true,
      data: {
        total,
        active,
        inactive: total - active,
        byCategory: stats,
      }
    });
  } catch (error) {
    console.error('Get template stats error:', error);
    res.status(500).json({ 
      success: false,
      message: "Server Error", 
      error: error.message 
    });
  }
};

module.exports = exports;