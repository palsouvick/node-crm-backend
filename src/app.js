const mongoose = require("mongoose");
const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");

const app = express();

// ✅ Correct CORS usage
app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api', require('./routes/customerRoutes'));
app.use('/api', require('./routes/leadRoutes'));
app.use('/api', require('./routes/followUpRoutes'));
app.use('/api', require('./routes/userRoutes'));
app.use('/api', require('./routes/campaignRoutes'));
app.use('/api', require('./routes/EmailTemplateRoute'));
app.use('/api', require('./routes/activityRoute'));
app.use('/api', require('./routes/CompanyRoute'));

app.get("/", (req, res) => {
  res.send("CRM Backend Running");
});

module.exports = app;