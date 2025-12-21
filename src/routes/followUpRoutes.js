const express = require('express');
const router = express.Router();
const { createFollowUp,
    getFollowUps,
    getFollowUpById, 
    updateFollowUp,
    deleteFollowUp, 
    completeFollowUp, 
    rescheduleFollowUp 
} = require('../controllers/followUpController');
const { protect, authorize } = require('../middlewares/authMiddleware');

router.use(protect);
router.post('/follow-up', authorize('admin', 'sales', 'support'), createFollowUp);
router.get('/follow-up', getFollowUps);
router.get('/follow-up/:id', getFollowUpById);
router.put('/follow-up/:id', authorize('admin', 'sales', 'support'), updateFollowUp);
router.delete('/follow-up/:id', authorize('admin'), deleteFollowUp);
router.put('/follow-up/:id/complete', authorize('admin', 'sales', 'support'), completeFollowUp);
router.put('/follow-up/:id/reschedule', authorize('admin', 'sales', 'support'), rescheduleFollowUp);