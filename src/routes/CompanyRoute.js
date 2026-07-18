const express = require('express');
const router = express.Router();
const companyController = require('../controllers/CompanyController');
const { protect, authorize } = require("../middlewares/authMiddleware");

router.use(protect);

router.post('/company',  authorize('admin', 'sales'), companyController.createCompany);
router.get('/company', authorize('admin', 'sales'), companyController.getCompanies);

router.get('/company/summary', authorize('admin', 'sales'), companyController.getCompanySummary);
router.get('/company/filter-options', authorize('admin', 'sales'), companyController.getCompanyFilterOptions);
router.get('/company/export', authorize('admin', 'sales'), companyController.exportCompanyData);
router.post('/company/bulk-status', authorize('admin', 'sales'), companyController.bulkUpdateCompanyStatus);
router.post('/company/bulk-assign-owner', authorize('admin', 'sales'), companyController.bulkAssignCompanyOwner);
router.post('/company/bulk-delete', authorize('admin'), companyController.bulkDeleteCompanies);

router.get('/company/:id', authorize('admin', 'sales'), companyController.getCompanyById);
router.put('/company/:id', authorize('admin', 'sales'), companyController.updateCompany);
router.delete('/company/:id', authorize('admin'), companyController.deleteCompany);

module.exports = router;