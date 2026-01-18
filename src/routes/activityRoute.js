const activityController = require("../controllers/activityController");
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/authMiddleware");

router.use(protect);

router.get("/activity", authorize("admin", "sales"), activityController.getActivitys);

module.exports = router;