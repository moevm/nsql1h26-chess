const express = require('express');
const ctrl = require('../controllers/gameController');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');

const router = express.Router();

router.get('/', optionalAuth, ctrl.list);
router.get('/:id', optionalAuth, ctrl.getById);
router.get('/:id/status-history', optionalAuth, ctrl.statusHistory);
router.get('/:id/edit', authMiddleware, ctrl.forEdit);
router.post('/', authMiddleware, ctrl.create);
router.put('/:id', authMiddleware, ctrl.update);
router.delete('/:id', authMiddleware, requireAdmin, ctrl.remove);

module.exports = router;
