const express = require('express');
const ctrl = require('../controllers/botController');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');

const router = express.Router();

router.get('/', optionalAuth, ctrl.list);
router.get('/:id', optionalAuth, ctrl.getById);
router.post('/', authMiddleware, requireAdmin, ctrl.create);
router.put('/:id', authMiddleware, requireAdmin, ctrl.update);
router.delete('/:id', authMiddleware, requireAdmin, ctrl.remove);

module.exports = router;
