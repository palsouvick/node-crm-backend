const mongoose = require("mongoose");

const CustomerSchema = new mongoose.Schema({
    name: {type: String, required: true,},
    email: {type: String, required: true, unique: true, index: true,lowercase: true,trim: true},
    phone: {type: String, required: false, unique: true,},
    company: {type: String, required: false,},
    status: {type: String, default: 'active'},
    assignedTo: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false,},
    createdBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true,},
    notes: {type: String, required: false,},
    isDeleted: {type: Boolean, default: false,},
    isLead: {type: Boolean, default: false,},
}, {timestamps: true});

module.exports = mongoose.model("Customer", CustomerSchema);