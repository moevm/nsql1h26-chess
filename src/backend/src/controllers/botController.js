const { handle } = require('../utils/handle');
const botService = require('../services/botService');

const list = handle(async (req, res) => res.json(await botService.listBots(req.query)));

const getById = handle(async (req, res) => res.json(await botService.getBotById(req.params.id)));

const create = handle(async (req, res) =>
  res.status(201).json(await botService.createBot(req.body, req.user))
);

const update = handle(async (req, res) =>
  res.json(await botService.updateBot(req.params.id, req.body, req.user))
);

const remove = handle(async (req, res) => res.json(await botService.deleteBot(req.params.id)));

module.exports = { list, getById, create, update, remove };
