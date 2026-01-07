const mongoose = require('mongoose');

const EmailTemplateSchema = new mongoose.Schema({
    name: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    body: {
      type: String, // HTML or plain text
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    
},{timestamps: true});
module.exports = mongoose.model('EmailTemplate', EmailTemplateSchema);