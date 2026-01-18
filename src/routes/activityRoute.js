const activityController = require("../controllers/activityController");
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/authMiddleware");

router.use(protect);

router.get("/activity", authorize("admin", "sales"), activityController.getActivitys);
router.get("/activity/count", authorize("admin", "sales"), activityController.totalActivityLog);

module.exports = router;