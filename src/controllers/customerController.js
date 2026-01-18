const Customer = require("../models/Customer");
const { Parser } = require("json2csv");
const mongoose = require("mongoose");
const logActivity = require("../utils/logActivity");

// Create a new customer
exports.createCustomer = async (req, res) => {
    try {
        const { name, email, phone, company, assignedTo, notes } = req.body;
        if (!name || !email) {
            return res.status(400).json({ message: "Name and email are required" });
        }
        const customer = await Customer.create({
            name,
            email,
            phone,
            company,
            assignedTo,
            createdBy: req.user._id,
            notes
        });
          await logActivity({
            userId: req.user._id,
            action: "CREATED",
            module: "customer",
            referenceId: customer._id,
            description: `Customer ${customer.name} created`,
        });
        await customer.save();
        res.status(201).json({ message: "Customer created successfully", customer });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// Get all customers
exports.getCustomers = async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 5;
        const skip = (page - 1) * limit;

        const {
            status,
            assignedTo,
            search
        } = req.query;

        const filter = {
            isDeleted: false
        };

        // Status filter
        if (status) {
            filter.status = status;
        }

        // Assigned user filter
        if (assignedTo) {
            filter.assignedTo = assignedTo;
        }

        // Search by name / phone / email
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ];
        }
        const [customers, total] = await Promise.all([
            Customer.find(filter)
            .populate("assignedTo", "name email")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),

            Customer.countDocuments(filter),
        ]);
        console.log(customers);
        res.status(200).json({
            data: customers,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

exports.getCustomerById = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id).populate("assignedTo", "name email").populate("createdBy", "name email");
        if (!customer) {
            return res.status(404).json({ message: "Customer not found" });
        }
        res.json({ customer });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// Update a customer
exports.updateCustomer = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid customer ID" });
    }

    try {
        const allowedFields = ["name", "email", "phone", "address", "status", "assignedTo"];
        const updates = {};

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "No valid fields to update" });
        }

        // 3️⃣ Update with validation
        const customer = await Customer.findByIdAndUpdate(
            id,
            updates,
            {
                new: true,
                runValidators: true
            }
        );
        if (!customer) {
            return res.status(404).json({ message: "Customer not found" });
        }
        await logActivity({
            userId: req.user._id,
            action: "UPDATED",
            module: "customer",
            referenceId: customer._id,
            description: `Customer ${customer.name} updated`,
        });
        res.json({ message: "Customer updated successfully", customer });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// Delete a customer
exports.deleteCustomer = async (req, res) => {
    try {
        const customer = await Customer.findByIdAndUpdate(req.params.id, { isDeleted: true }, { new: true });
        if (!customer) {
            return res.status(404).json({ message: "Customer not found" });
        }
         await logActivity({
            userId: req.user._id,
            action: "DELETED",
            module: "customer",
            referenceId: customer._id,
            description: `Customer ${customer.name} soft deleted`,
        });

        res.json({ message: "Customer deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

exports.restoreCustomer = async (req, res) => {
    try {
        const customer = await Customer.findByIdAndUpdate(req.params.id, { isDeleted: false }, { new: true });
        if (!customer) {
            return res.status(404).json({ message: "Customer not found" });
        }
        await logActivity({
            userId: req.user._id,
            action: "RESTORED",
            module: "customer",
            referenceId: customer._id,
            description: `Customer ${customer.name} restored`,
        });
        res.json({ message: "Customer restored successfully", customer });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

exports.exportCustomerData = async (req, res) => {
  try {
    const customers = await Customer.find({
      $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
    })
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .lean(); // 🔥 important for performance

    // 🔹 Flatten data for CSV
    const formattedData = customers.map(c => ({
      id: c._id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      company: c.company,
      status: c.status,
      assignedToName: c.assignedTo?.name || "",
      assignedToEmail: c.assignedTo?.email || "",
      createdByName: c.createdBy?.name || "",
      createdByEmail: c.createdBy?.email || "",
      createdAt: c.createdAt
    }));

    const fields = [
      "id",
      "name",
      "email",
      "phone",
      "company",
      "status",
      "assignedToName",
      "assignedToEmail",
      "createdByName",
      "createdByEmail",
      "createdAt"
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(formattedData);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=customers.csv");

    return res.status(200).send(csv);
  } catch (error) {
    console.error("Export Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
exports.totalCustomer = async(req, res) => {
    try {
        const total = await Customer.countDocuments({ isDeleted: false });
        res.json({ total });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
}