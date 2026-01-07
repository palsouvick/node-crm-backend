const express = require('express');
const router = express.Router();
const {
    createEmailTemplate,
    getEmailTemplates,
    updateEmailTemplate,
    deleteEmailTemplate,
    getEmailTemplateById
} = require('../controllers/emailTemplateController');
const { protect, authorize } = require("../middlewares/authMiddleware");

router.use(protect);

router.post('/email-templates', authorize('admin'), createEmailTemplate);
router.get('/email-templates', authorize('admin'), getEmailTemplates);
router.put('/email-templates/:id', authorize('admin'), updateEmailTemplate);
router.delete('/email-templates/:id', authorize('admin'), deleteEmailTemplate);
router.get('/email-templates/:id', authorize('admin'), getEmailTemplateById);

module.exports = router;