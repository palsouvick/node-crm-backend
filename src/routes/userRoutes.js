const express = require('express');
const router = express.Router();

const {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserSummary,
  getUserFilterOptions,
  exportUserData,
  bulkUpdateStatus,
  bulkDeleteUsers,
  resetUserPassword,
  importUsers,
  uploadUserImport,
} = require('../controllers/UserController');
const { protect, authorize } = require('../middlewares/authMiddleware');

router.use(protect);

router.post('/user', authorize('admin'), createUser);
router.get('/user', authorize('admin'), getUsers);

router.get('/user/summary', authorize('admin'), getUserSummary);
router.get('/user/filter-options', authorize('admin'), getUserFilterOptions);
router.get('/user/export', authorize('admin'), exportUserData);
router.post('/user/bulk-status', authorize('admin'), bulkUpdateStatus);
router.post('/user/bulk-delete', authorize('admin'), bulkDeleteUsers);
router.post('/user/import', authorize('admin'), uploadUserImport, importUsers);

router.get('/user/:id', authorize('admin', 'user'), getUserById);
router.put('/user/:id', authorize('admin', 'user'), updateUser);
router.put('/user/:id/reset-password', authorize('admin'), resetUserPassword);
router.delete('/user/:id', authorize('admin'), deleteUser);

module.exports = router;