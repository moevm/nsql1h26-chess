const { handle } = require('../utils/handle');
const playerService = require('../services/playerService');

const list = handle(async (req, res) => res.json(await playerService.listPlayers(req.query)));

const getById = handle(async (req, res) => res.json(await playerService.getPlayerById(req.params.id)));

const games = handle(async (req, res) =>
  res.json(await playerService.getPlayerGames(req.params.id, req.query))
);

const statusHistory = handle(async (req, res) =>
  res.json(await playerService.getStatusHistory(req.params.id))
);

const update = handle(async (req, res) =>
  res.json(await playerService.updatePlayer(req.params.id, req.body, req.user))
);

const eloHistory = handle(async (req, res) =>
  res.json(await playerService.getEloHistory(req.params.id, req.query))
);

module.exports = { list, getById, games, statusHistory, update, eloHistory };
