const User = require("../models/User");
const Lead = require("../models/Lead");
const Customer = require("../models/Customer");
const bcrypt = require("bcryptjs");
const { Parser } = require("json2csv");
const csv = require("csv-parser");
const multer = require("multer");
const { Readable } = require("stream");

const ROLE_KEYS = ["admin", "sales", "support", "manager", "user"];

const parseCsvBuffer = (buffer) =>
  new Promise((resolve, reject) => {
    const rows = [];
    Readable.from(buffer.toString("utf-8"))
      .pipe(csv())
      .on("data", (row) => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", reject);
  });

exports.uploadUserImport = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.toLowerCase().endsWith(".csv")) {
      return cb(null, true);
    }
    cb(new Error("Only CSV files are allowed"));
  },
}).single("file");

// get all users
exports.getUsers = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    const { search, role, status } = req.query;

    // ✅ Base filter
    const filter = {
      $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
    };

    // ✅ Role filter
    if (role) {
      filter.role = role;
    }

    // ✅ Status filter
    if (status) {
      filter.status = status;
    }

    // ✅ Search filter
    if (search) {
      filter.$and = [
        {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
          ],
        },
      ];
    }

    // ✅ Fetch users + total count
    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      User.countDocuments(filter),
    ]);

    // ✅ Per-row assigned leads/customers counts (2 grouped queries, not N+1)
    const pageUserIds = users.map((u) => u._id);
    const [leadCounts, customerCounts] = await Promise.all([
      Lead.aggregate([
        { $match: { isDeleted: false, assignedTo: { $in: pageUserIds } } },
        { $group: { _id: "$assignedTo", count: { $sum: 1 } } },
      ]),
      Customer.aggregate([
        { $match: { isDeleted: false, assignedTo: { $in: pageUserIds } } },
        { $group: { _id: "$assignedTo", count: { $sum: 1 } } },
      ]),
    ]);
    const leadCountMap = Object.fromEntries(
      leadCounts.map((row) => [row._id.toString(), row.count])
    );
    const customerCountMap = Object.fromEntries(
      customerCounts.map((row) => [row._id.toString(), row.count])
    );
    const usersWithCounts = users.map((user) => ({
      ...user.toObject(),
      assignedLeadsCount: leadCountMap[user._id.toString()] || 0,
      assignedCustomersCount: customerCountMap[user._id.toString()] || 0,
    }));

    res.json({
      data: usersWithCounts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get Users Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Create a new user
exports.createUser = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      status,
      password,
      role,
      dob,
      employeeId,
      department,
      designation,
      joiningDate,
      address,
      metadata,
    } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (await User.findOne({ email })) {
      return res.status(400).json({
        message: "Email already exists",
        field: "email",
        code: "EMAIL_EXISTS",
      });
    }

    if (await User.findOne({ phone })) {
      return res.status(400).json({
        message: "Phone number already exists",
        field: "phone",
        code: "PHONE_EXISTS",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      name,
      email,
      phone,
      status,
      password: hashedPassword,
      role,
      dob,
      employeeId: employeeId || undefined,
      department,
      designation,
      joiningDate,
      address,
      metadata,
    });
    await user.save();
    res.status(201).json({ message: "User created successfully", user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update user
const UPDATABLE_FIELDS = [
  "name",
  "email",
  "phone",
  "status",
  "role",
  "dob",
  "employeeId",
  "department",
  "designation",
  "joiningDate",
  "address",
  "metadata",
];

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    UPDATABLE_FIELDS.forEach((field) => {
      if (req.body[field] === undefined) return;
      // Empty employeeId must be unset, not stored as "", so the sparse
      // unique index doesn't treat two cleared users as a duplicate "".
      if (field === "employeeId" && !req.body[field]) {
        user.employeeId = undefined;
        return;
      }
      user[field] = req.body[field];
    });
    if (req.body.password) {
      user.password = await bcrypt.hash(req.body.password, 10);
    }
    await user.save();
    res.json({ message: "User updated successfully", user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    user.isDeleted = true;
    await user.save();
    res.json({ message: "User deleted successfully", user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /user/summary
exports.getUserSummary = async (req, res) => {
  try {
    const [total, active, inactive, byRoleRows] = await Promise.all([
      User.countDocuments({ isDeleted: false }),
      User.countDocuments({ isDeleted: false, status: "active" }),
      User.countDocuments({ isDeleted: false, status: "inactive" }),
      User.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: "$role", count: { $sum: 1 } } },
      ]),
    ]);

    const byRole = Object.fromEntries(ROLE_KEYS.map((role) => [role, 0]));
    byRoleRows.forEach((row) => {
      if (row._id in byRole) byRole[row._id] = row.count;
    });

    res.json({ total, active, inactive, byRole });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /user/filter-options
exports.getUserFilterOptions = async (req, res) => {
  try {
    const [departments, designations] = await Promise.all([
      User.distinct("department", { isDeleted: false, department: { $nin: [null, ""] } }),
      User.distinct("designation", { isDeleted: false, designation: { $nin: [null, ""] } }),
    ]);
    res.json({ departments, designations });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /user/export
exports.exportUserData = async (req, res) => {
  try {
    const { search, role, status, department, designation, dateFrom, dateTo, ids } =
      req.query;

    const filter = {
      $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
    };
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (department) filter.department = department;
    if (designation) filter.designation = designation;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }
    if (ids) {
      filter._id = { $in: ids.split(",") };
    }
    if (search) {
      filter.$and = [
        {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
          ],
        },
      ];
    }

    const users = await User.find(filter).select("-password");
    const rows = users.map((user) => ({
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      department: user.department,
      designation: user.designation,
      employeeId: user.employeeId,
      joiningDate: user.joiningDate,
      createdAt: user.createdAt,
    }));

    const fields = [
      { label: "Name", value: "name" },
      { label: "Email", value: "email" },
      { label: "Phone", value: "phone" },
      { label: "Role", value: "role" },
      { label: "Status", value: "status" },
      { label: "Department", value: "department" },
      { label: "Designation", value: "designation" },
      { label: "Employee ID", value: "employeeId" },
      { label: "Joining Date", value: "joiningDate" },
      { label: "Created At", value: "createdAt" },
    ];
    const parser = new Parser({ fields });
    const csv = parser.parse(rows);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=users.csv");
    res.status(200).send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /user/bulk-status  { ids: [], status }
exports.bulkUpdateStatus = async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || !status) {
      return res.status(400).json({ message: "ids and status are required" });
    }
    await User.updateMany({ _id: { $in: ids } }, { $set: { status } });
    res.json({ message: "Users updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /user/bulk-delete  { ids: [] }
exports.bulkDeleteUsers = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "ids are required" });
    }
    await User.updateMany({ _id: { $in: ids } }, { $set: { isDeleted: true } });
    res.json({ message: "Users deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /user/:id/reset-password  { password }
exports.resetUserPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    user.password = await bcrypt.hash(password, 10);
    await user.save();
    res.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /user/import  (multipart/form-data, field "file")
exports.importUsers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "A CSV file is required" });
    }

    const rows = await parseCsvBuffer(req.file.buffer);
    if (rows.length === 0) {
      return res.status(400).json({ message: "The CSV file is empty" });
    }

    const existingEmails = new Set(
      (await User.find({}).select("email")).map((u) => u.email.toLowerCase())
    );

    const errors = [];
    const toInsert = [];
    const seenInFile = new Set();

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // account for the header row
      const row = rows[i];
      const name = row.Name?.trim();
      const email = row.Email?.trim().toLowerCase();
      const password = row.Password?.trim();
      const role = row.Role?.trim().toLowerCase() || "user";

      if (!name || !email || !password) {
        errors.push({ row: rowNumber, email, message: "Name, Email and Password are required" });
        continue;
      }
      if (!ROLE_KEYS.includes(role)) {
        errors.push({ row: rowNumber, email, message: `"${role}" is not a valid role` });
        continue;
      }
      if (password.length < 6) {
        errors.push({ row: rowNumber, email, message: "Password must be at least 6 characters" });
        continue;
      }
      if (existingEmails.has(email) || seenInFile.has(email)) {
        errors.push({ row: rowNumber, email, message: "Email already exists" });
        continue;
      }

      seenInFile.add(email);
      toInsert.push({
        name,
        email,
        phone: row.Phone?.trim() || undefined,
        password: await bcrypt.hash(password, 10),
        role,
        status: row.Status?.trim().toLowerCase() || "active",
        department: row.Department?.trim() || undefined,
        designation: row.Designation?.trim() || undefined,
        employeeId: row["Employee ID"]?.trim() || undefined,
        joiningDate: row["Joining Date"]?.trim() || undefined,
      });
    }

    let createdCount = 0;
    if (toInsert.length > 0) {
      try {
        const created = await User.insertMany(toInsert, { ordered: false });
        createdCount = created.length;
      } catch (bulkError) {
        // insertMany with ordered:false still throws after partial success —
        // report what actually landed via the driver's own result count.
        createdCount = bulkError.result?.insertedCount || bulkError.insertedDocs?.length || 0;
        errors.push({ row: null, email: null, message: "Some rows failed during insert" });
      }
    }

    res.status(200).json({
      totalRows: rows.length,
      createdCount,
      skippedCount: rows.length - createdCount,
      errors,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
