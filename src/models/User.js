const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
    name: {type: String, required: true,},
    email: {type: String, required: true, unique: true, index: true},
    phone: {type: String, required: false, unique: true,},
    password: {type: String, required: true,},
    status: {type: String, default: 'active'},
    role: {type: String, enum: ["admin", "sales", "support"], default: 'admin'},
    dob: {type: Date, required: false},
    metadata: {type: Object, required: false},
    lastLogin: {
      type: Date,
      required: false,
    },
}, {timestamps: true});

module.exports = mongoose.model("User", UserSchema);