const express = require('express');
const ctrl = require('../controllers/playerController');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', optionalAuth, ctrl.list);
router.get('/:id', optionalAuth, ctrl.getById);
router.get('/:id/games', optionalAuth, ctrl.games);
router.get('/:id/status-history', optionalAuth, ctrl.statusHistory);
router.put('/:id', authMiddleware, ctrl.update);

module.exports = router;
