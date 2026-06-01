const express = require('express');
const path = require('path');
const fs = require('fs');
const { handle } = require('../utils/handle');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { botOrUserAuth } = require('../middleware/botAuth');
const ctrl = require('../controllers/circularChessController');

const router = express.Router();

const LIB_PATH = path.join(__dirname, '..', 'game', 'circular-chess.js');
let LIB_CACHE = null;

router.get('/lib.js', (req, res) => {
  if (!LIB_CACHE) LIB_CACHE = fs.readFileSync(LIB_PATH, 'utf8');
  res.set('Content-Type', 'application/javascript; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=60');
  res.send(LIB_CACHE);
});

router.get('/games', optionalAuth, handle(ctrl.listGames));
router.get('/games/:id', optionalAuth, handle(ctrl.getGame));
router.get('/games/:id/legal-moves', optionalAuth, handle(ctrl.getLegalMoves));

router.post('/games', authMiddleware, handle(ctrl.createGame));
router.post('/games/:id/moves', botOrUserAuth, handle(ctrl.makeMove));
router.post('/games/:id/resign', botOrUserAuth, handle(ctrl.resignGame));
router.post('/games/:id/draw', botOrUserAuth, handle(ctrl.drawGame));
router.post('/games/:id/abandon', botOrUserAuth, handle(ctrl.abandonGame));
router.patch('/games/:id', botOrUserAuth, handle(ctrl.updateGame));

module.exports = router;
