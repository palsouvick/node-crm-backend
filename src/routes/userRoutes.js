const express = require('express');
const router = express.Router();

const { createUser, getUsers, getUserById, updateUser, deleteUser } = require('../controllers/UserController');
const { protect, authorize } = require('../middlewares/authMiddleware');

router.use(protect);

router.post('/user', authorize('admin'), createUser);
router.get('/user', authorize('admin'), getUsers);
router.get('/user/:id', authorize('admin', 'user'), getUserById);
router.put('/user/:id', authorize('admin', 'user'), updateUser);
router.delete('/user/:id', authorize('admin'), deleteUser);

module.exports = router;