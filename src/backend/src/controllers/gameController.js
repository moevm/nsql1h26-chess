const { handle } = require('../utils/handle');
const gameService = require('../services/gameService');

const list = handle(async (req, res) => res.json(await gameService.listGames(req.query)));

const getById = handle(async (req, res) => res.json(await gameService.getGameById(req.params.id)));

const statusHistory = handle(async (req, res) =>
  res.json(await gameService.getGameStatusHistory(req.params.id))
);

const forEdit = handle(async (req, res) => res.json(await gameService.getGameForEdit(req.params.id)));

const create = handle(async (req, res) =>
  res.status(201).json(await gameService.createGame(req.body, req.user))
);

const update = handle(async (req, res) =>
  res.json(await gameService.updateGame(req.params.id, req.body, req.user))
);

const remove = handle(async (req, res) => res.json(await gameService.deleteGame(req.params.id)));

const participants = handle(async (req, res) =>
  res.json(await gameService.listParticipants(req.query))
);

module.exports = { list, getById, statusHistory, forEdit, create, update, remove, participants };
