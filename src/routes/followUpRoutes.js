const express = require('express');
const router = express.Router();
const { createFollowUp,
    getFollowUps,
    getFollowUpById, 
    updateFollowUp,
    deleteFollowUp, 
    completeFollowUp, 
    rescheduleFollowUp,
    totalFollowUps
} = require('../controllers/followUpController');
const { protect, authorize } = require('../middlewares/authMiddleware');

router.use(protect);
router.post('/follow-ups', authorize('admin', 'sales', 'support'), createFollowUp);
router.get('/follow-ups', getFollowUps);
router.get('/follow-ups/count', totalFollowUps);
router.get('/follow-ups/:id', getFollowUpById);
router.put('/follow-ups/:id', authorize('admin', 'sales', 'support'), updateFollowUp);
router.delete('/follow-ups/:id', authorize('admin'), deleteFollowUp);
router.put('/follow-ups/:id/complete', authorize('admin', 'sales', 'support'), completeFollowUp);
router.put('/follow-ups/:id/reschedule', authorize('admin', 'sales', 'support'), rescheduleFollowUp);

module.exports = router;