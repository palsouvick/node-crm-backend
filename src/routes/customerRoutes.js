const express = require("express");
const router = express.Router();
const {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  exportCustomerData,
  restoreCustomer,
  totalCustomer
} = require("../controllers/customerController");

const { protect, authorize } = require("../middlewares/authMiddleware");

router.use(protect);

router.post("/customer/restore/:id", authorize("admin"), restoreCustomer);
router.get("/customer/export", authorize("admin", "sales"), exportCustomerData);
router.get("/customer/count", totalCustomer);

router.post("/customer", authorize("admin", "sales"), createCustomer);
router.get("/customer", getCustomers);

router.get("/customer/:id", getCustomerById);
router.put("/customer/:id", authorize("admin", "sales"), updateCustomer);
router.delete("/customer/:id", authorize("admin"), deleteCustomer);

module.exports = router;
