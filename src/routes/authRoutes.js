const express = require("express");
const router = express.Router();
const { register, login,
    updateProfile, getProfile, changePassword
 } = require("../controllers/authController");

const { protect } = require("../middlewares/authMiddleware");

// router.use(protect);

router.post("/register", register);
router.post("/login", login);
router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.put("/change-password", changePassword);

module.exports = router;
