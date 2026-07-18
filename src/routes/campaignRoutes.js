const express = require('express');
const router = express.Router();
const {
    createCampaign,
    getCampaigns,
    startCampaign,
    updateCampaign,
    deleteCampaign,
    getCampaignById,
    sendTestEmail,
    duplicateCampaign,
    pauseCampaign,
    resumeCampaign,
    archiveCampaign,
    getCampaignSummary,
    getCampaignFilterOptions,
    exportCampaignData,
    bulkPauseCampaigns,
    bulkResumeCampaigns,
    bulkArchiveCampaigns,
    bulkDeleteCampaigns,
} = require('../controllers/campaignController');
const { protect, authorize } = require("../middlewares/authMiddleware");

router.use(protect);

router.post('/campaigns', authorize('admin'), createCampaign);
router.get('/campaigns', authorize('admin'), getCampaigns);

router.get('/campaigns/summary', authorize('admin'), getCampaignSummary);
router.get('/campaigns/filter-options', authorize('admin'), getCampaignFilterOptions);
router.get('/campaigns/export', authorize('admin'), exportCampaignData);
router.post('/campaigns/bulk-pause', authorize('admin'), bulkPauseCampaigns);
router.post('/campaigns/bulk-resume', authorize('admin'), bulkResumeCampaigns);
router.post('/campaigns/bulk-archive', authorize('admin'), bulkArchiveCampaigns);
router.post('/campaigns/bulk-delete', authorize('admin'), bulkDeleteCampaigns);

router.post('/campaigns/start/:id', authorize('admin'), startCampaign);
router.post('/campaigns/send-test-email/:id', authorize('admin'), sendTestEmail);
router.post('/campaigns/:id/duplicate', authorize('admin'), duplicateCampaign);
router.post('/campaigns/:id/pause', authorize('admin'), pauseCampaign);
router.post('/campaigns/:id/resume', authorize('admin'), resumeCampaign);
router.post('/campaigns/:id/archive', authorize('admin'), archiveCampaign);

router.get('/campaigns/:id', authorize('admin'), getCampaignById);
router.put('/campaigns/:id', authorize('admin'), updateCampaign);
router.delete('/campaigns/:id', authorize('admin'), deleteCampaign);

module.exports = router;