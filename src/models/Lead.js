const mongoose = require("mongoose");

const LeadSchema = new mongoose.Schema({
    customar: {type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true,},
    status: {type: String, enum: ["new", "contacted", "qualified", "won", "lost"], default: 'new'},
    expectedValue: {type: Number, default: 0},
    assignedTo: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false,},
    createdBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true,},
    remarks: {type: String, required: false,},
    source: {type: String, enum: ["website", "call", "email", "referral", "other"], default: "website",},
    metadata: {type: Object, required: false,},
    isDeleted: {type: Boolean, default: false,}
}, {timestamps: true});

module.exports = mongoose.model("Lead", LeadSchema);