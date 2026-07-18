const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    phone: { type: String, required: false, unique: true },
    password: { type: String, required: true },
    status: { type: String, default: "active" },
    role: { type: String, default: "user" },
    dob: { type: Date, required: false },
    employeeId: { type: String, required: false, unique: true, sparse: true },
    department: { type: String, required: false },
    designation: { type: String, required: false },
    joiningDate: { type: Date, required: false },
    address: { type: String, required: false },
    metadata: { type: Object, required: false },
    lastLogin: {
      type: Date,
      required: false,
    },
    isDeleted: { type: Boolean, default: false },
    resetOtp: {
      type: String,
    },
    resetOtpExpires: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
