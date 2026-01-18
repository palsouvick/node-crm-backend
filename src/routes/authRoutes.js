const express = require("express");
const router = express.Router();
const { register, login,
    updateProfile, getProfile, changePassword, forgotPassword, verifyOtp
 } = require("../controllers/authController");

const { protect } = require("../middlewares/authMiddleware");

// router.use(protect);

router.post("/register", register);
router.post("/login", login);
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOtp);
router.put("/change-password", changePassword);

module.exports = router;
