const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
    name: {type: String, required: true,},
    email: {type: String, required: true, unique: true,},
    phone: {type: String, required: false, unique: true,},
    password: {type: String, required: true,},
    status: {type: String, default: 'active'},
    role: {type: String, default: 'user'},
    dob: {type: Date, required: false},
    metadata: {type: Object, required: false},
}, {timestamps: true});

module.exports = mongoose.model("User", UserSchema);