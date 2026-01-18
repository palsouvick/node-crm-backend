const express = require('express');
const router = express.Router();
const companyController = require('../controllers/CompanyController');
const { protect, authorize } = require("../middlewares/authMiddleware");

router.use(protect);

router.post('/company',  authorize('admin', 'sales'), companyController.createCompany);
router.get('/company', authorize('admin', 'sales'), companyController.getCompanies);
router.get('/company/:id', authorize('admin', 'sales'), companyController.getCompanyById);
router.put('/company/:id', authorize('admin', 'sales'), companyController.updateCompany);
router.delete('/company/:id', authorize('admin'), companyController.deleteCompany);

module.exports = router;