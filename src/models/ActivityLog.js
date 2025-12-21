const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    module: { type: String, required: true },
    referenceId: { type: mongoose.Schema.Types.ObjectId, required: false },
    details: { type: mongoose.Schema.Types.Mixed },
    description: { type: String, required: false }
}, { timestamps: true });

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);