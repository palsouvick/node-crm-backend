const express = require('express');
const router = express.Router();
const {
    createCampaign,
    getCampaigns,
    startCampaign,
    updateCampaign,
    deleteCampaign,
    getCampaignById,
    sendTestEmail
} = require('../controllers/campaignController');
const { protect, authorize } = require("../middlewares/authMiddleware");

router.use(protect);

router.post('/campaigns', authorize('admin'), createCampaign);
router.get('/campaigns', authorize('admin'), getCampaigns);
router.post('/campaigns/start/:id', authorize('admin'), startCampaign);
router.post('/campaigns/send-test-mail/:id', authorize('admin'), sendTestEmail);
router.get('/campaigns/:id', authorize('admin'), getCampaignById);
router.put('/campaigns/:id', authorize('admin'), updateCampaign);
router.delete('/campaigns/:id', authorize('admin'), deleteCampaign);

module.exports = router;