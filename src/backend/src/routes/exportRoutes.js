const express = require('express');
const ctrl = require('../controllers/exportController');
const { authMiddleware } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');

const router = express.Router();

router.get('/export', authMiddleware, ctrl.exportAll);
router.post('/import', authMiddleware, requireAdmin, ctrl.importAll);

module.exports = router;
