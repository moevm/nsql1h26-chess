const service = require('../services/circularChessService');
const ApiError = require('../utils/ApiError');

function parseFromParam(raw) {
  if (!raw) return null;
  const m = String(raw).match(/^r(\d+)s(\d+)$/);
  if (!m) throw new ApiError(400, 'Параметр from должен быть в формате r{ring}s{sector}');
  return { r: parseInt(m[1], 10), s: parseInt(m[2], 10) };
}

function actorFromReq(req) {
  if (req.bot) return req.bot;
  if (req.user) return req.user;
  return null;
}

async function listGames(req, res) {
  const result = await service.listGames(req.query);
  res.json(result);
}

async function getGame(req, res) {
  const game = await service.getGame(req.params.id);
  res.json(game);
}

async function createGame(req, res) {
  const game = await service.createGame(req.body, req.user);
  res.status(201).json(game);
}

async function getLegalMoves(req, res) {
  const from = parseFromParam(req.query.from);
  const moves = await service.getLegalMoves(req.params.id, from);
  res.json({ from, moves });
}

async function makeMove(req, res) {
  const actor = actorFromReq(req);
  const input = req.body && (req.body.notation || req.body.move ||
    (req.body.from && req.body.to ? { from: req.body.from, to: req.body.to, promotion: req.body.promotion || null } : null));
  if (!input) throw new ApiError(400, 'Нужно поле notation или {from, to, promotion?}');
  const result = await service.makeMove(req.params.id, input, actor);
  res.status(201).json(result);
}

async function resignGame(req, res) {
  const actor = actorFromReq(req);
  const game = await service.resignGame(req.params.id, actor);
  res.json(game);
}

async function drawGame(req, res) {
  const actor = actorFromReq(req);
  const game = await service.drawGame(req.params.id, actor);
  res.json(game);
}

async function abandonGame(req, res) {
  const actor = actorFromReq(req);
  const game = await service.abandonGame(req.params.id, actor);
  res.json(game);
}

async function updateGame(req, res) {
  const actor = actorFromReq(req);
  const game = await service.updateGameMeta(req.params.id, actor, req.body || {});
  res.json(game);
}

module.exports = {
  listGames, getGame, createGame, getLegalMoves, makeMove,
  resignGame, drawGame, abandonGame, updateGame
};
