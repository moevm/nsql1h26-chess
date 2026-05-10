const express = require('express');
const ctrl = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/login', ctrl.login);
router.post('/register', ctrl.register);
router.get('/me', authMiddleware, ctrl.me);

module.exports = router;
