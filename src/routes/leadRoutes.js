const express = require('express');
const router = express.Router();
const { createLead, getLeads, getLeadById, updateLead, deleteLead,
    searchLeads,
    assignLead
 } = require('../controllers/LeadController');
const { protect, authorize } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/leads/search', searchLeads);

router.post('/lead', authorize('admin', 'sales'), createLead);
router.get('/lead', getLeads);

router.put('/lead/:id/assign', authorize('admin', 'sales'), assignLead);
router.get('/lead/:id', getLeadById);
router.put('/lead/:id', authorize('admin', 'sales'), updateLead);
router.delete('/lead/:id', authorize('admin'), deleteLead);