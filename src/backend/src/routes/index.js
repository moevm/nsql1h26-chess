const express = require('express');
const authRoutes = require('./auth');
const playerRoutes = require('./players');
const botRoutes = require('./bots');
const gameRoutes = require('./games');
const statsRoutes = require('./stats');
const exportRoutes = require('./exportRoutes');
const ccRoutes = require('./circularChess');
const gameController = require('../controllers/gameController');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/players', playerRoutes);
router.use('/bots', botRoutes);
router.use('/games', gameRoutes);
router.use('/stats', statsRoutes);
router.use('/cc', ccRoutes);
router.use('/', exportRoutes);

router.get('/participants', optionalAuth, gameController.participants);

module.exports = router;
