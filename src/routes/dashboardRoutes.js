const express = require("express");
const router = express.Router();
const { getSummary } = require("../controllers/dashboardController");
const { protect } = require("../middlewares/authMiddleware");

router.use(protect);

router.get("/dashboard/summary", getSummary);

module.exports = router;
