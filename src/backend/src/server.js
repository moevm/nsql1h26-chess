const express = require('express');
const cors = require('cors');
const { PORT } = require('./config/env');
const { connectDB } = require('./db/connection');
const { seedRoles, seedStats, seedPasswords } = require('./db/seed');
const { authMiddleware, optionalAuth } = require('./middleware/auth');
const { requireAdmin } = require('./middleware/admin');
const { handle } = require('./utils/handle');
const authService = require('./services/authService');
const playerService = require('./services/playerService');
const botService = require('./services/botService');
const gameService = require('./services/gameService');
const statsService = require('./services/statsService');
const exportService = require('./services/exportService');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// auth
app.post('/api/auth/login', handle(async (req, res) => {
  res.json(await authService.login(req.body));
}));
app.post('/api/auth/register', handle(async (req, res) => {
  res.status(201).json(await authService.register(req.body));
}));
app.get('/api/auth/me', authMiddleware, handle(async (req, res) => {
  res.json(await authService.getMe(req.user.id));
}));

// players
app.get('/api/players', optionalAuth, handle(async (req, res) => {
  res.json(await playerService.listPlayers(req.query));
}));
app.get('/api/players/:id', optionalAuth, handle(async (req, res) => {
  res.json(await playerService.getPlayerById(req.params.id));
}));
app.get('/api/players/:id/games', optionalAuth, handle(async (req, res) => {
  res.json(await playerService.getPlayerGames(req.params.id, req.query));
}));
app.get('/api/players/:id/status-history', optionalAuth, handle(async (req, res) => {
  res.json(await playerService.getStatusHistory(req.params.id));
}));
app.put('/api/players/:id', authMiddleware, handle(async (req, res) => {
  res.json(await playerService.updatePlayer(req.params.id, req.body, req.user));
}));

// bots
app.get('/api/bots', optionalAuth, handle(async (req, res) => {
  res.json(await botService.listBots(req.query));
}));
app.get('/api/bots/:id', optionalAuth, handle(async (req, res) => {
  res.json(await botService.getBotById(req.params.id));
}));
app.post('/api/bots', authMiddleware, requireAdmin, handle(async (req, res) => {
  res.status(201).json(await botService.createBot(req.body, req.user));
}));
app.put('/api/bots/:id', authMiddleware, requireAdmin, handle(async (req, res) => {
  res.json(await botService.updateBot(req.params.id, req.body, req.user));
}));
app.delete('/api/bots/:id', authMiddleware, requireAdmin, handle(async (req, res) => {
  res.json(await botService.deleteBot(req.params.id));
}));

// games
app.get('/api/games', optionalAuth, handle(async (req, res) => {
  res.json(await gameService.listGames(req.query));
}));
app.get('/api/games/:id', optionalAuth, handle(async (req, res) => {
  res.json(await gameService.getGameById(req.params.id));
}));
app.get('/api/games/:id/status-history', optionalAuth, handle(async (req, res) => {
  res.json(await gameService.getGameStatusHistory(req.params.id));
}));
app.get('/api/games/:id/edit', authMiddleware, handle(async (req, res) => {
  res.json(await gameService.getGameForEdit(req.params.id));
}));
app.post('/api/games', authMiddleware, handle(async (req, res) => {
  res.status(201).json(await gameService.createGame(req.body, req.user));
}));
app.put('/api/games/:id', authMiddleware, handle(async (req, res) => {
  res.json(await gameService.updateGame(req.params.id, req.body, req.user));
}));
app.delete('/api/games/:id', authMiddleware, requireAdmin, handle(async (req, res) => {
  res.json(await gameService.deleteGame(req.params.id));
}));

// participants
app.get('/api/participants', optionalAuth, handle(async (req, res) => {
  res.json(await gameService.listParticipants(req.query));
}));

// stats
app.get('/api/stats/overview', optionalAuth, handle(async (req, res) => {
  res.json(await statsService.overview());
}));

// export / import
app.get('/api/export', optionalAuth, handle(async (req, res) => {
  const data = await exportService.exportAll();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="chess-export-${Date.now()}.json"`);
  res.json(data);
}));
app.post('/api/import', authMiddleware, requireAdmin, handle(async (req, res) => {
  res.json(await exportService.importAll(req.body));
}));

connectDB()
  .then(async () => {
    await seedRoles();
    await seedStats();
    await seedPasswords();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to start:', err);
    process.exit(1);
  });
