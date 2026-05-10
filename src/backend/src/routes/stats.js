const express = require('express');
const ctrl = require('../controllers/statsController');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/overview', optionalAuth, ctrl.overview);

module.exports = router;
