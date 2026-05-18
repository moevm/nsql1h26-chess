const crypto = require('crypto');
const { ObjectId, Int32 } = require('mongodb');
const { playersCol } = require('../models/playerModel');
const { gamesCol } = require('../models/gameModel');
const ApiError = require('../utils/ApiError');

const newApiKey = () => crypto.randomBytes(16).toString('hex');

const zeroStats = () => ({
  wins: new Int32(0),
  losses: new Int32(0),
  draws: new Int32(0),
  total_games: new Int32(0),
  elo: new Int32(0)
});

function applyRangeFilter(filter, key, min, max) {
  if (min || max) {
    filter[key] = {};
    if (min) filter[key].$gte = parseInt(min);
    if (max) filter[key].$lte = parseInt(max);
  }
}

function applyDateRangeFilter(filter, key, from, to) {
  if (from || to) {
    filter[key] = {};
    if (from) filter[key].$gte = new Date(from);
    if (to) filter[key].$lte = new Date(to + 'T23:59:59Z');
  }
}

async function listBots(q) {
  const filter = { type: 'bot' };
  if (q.name) filter.name = { $regex: q.name, $options: 'i' };
  if (q.api_url) filter.api_url = { $regex: q.api_url, $options: 'i' };
  if (q.status) filter.status = q.status;
  if (q.comment) filter.comment = { $regex: q.comment, $options: 'i' };

  applyRangeFilter(filter, 'stats.wins', q.wins_min, q.wins_max);
  applyRangeFilter(filter, 'stats.losses', q.losses_min, q.losses_max);
  applyRangeFilter(filter, 'stats.draws', q.draws_min, q.draws_max);
  applyRangeFilter(filter, 'stats.total_games', q.total_min, q.total_max);
  applyRangeFilter(filter, 'stats.elo', q.elo_min, q.elo_max);
  applyDateRangeFilter(filter, 'created_at', q.created_from, q.created_to);
  applyDateRangeFilter(filter, 'updated_at', q.updated_from, q.updated_to);

  const pageNum = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));
  const skip = (pageNum - 1) * limit;
  const sortField = q.sort_by || 'created_at';
  const sortDirection = q.sort_dir === 'asc' ? 1 : -1;

  const [bots, total] = await Promise.all([
    playersCol().find(filter)
      .sort({ [sortField]: sortDirection })
      .skip(skip).limit(limit).toArray(),
    playersCol().countDocuments(filter)
  ]);

  return {
    data: bots,
    pagination: { page: pageNum, limit, total, pages: Math.ceil(total / limit) }
  };
}

async function getBotById(id) {
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'Некорректный ID');
  const bot = await playersCol().findOne({ _id: new ObjectId(id), type: 'bot' });
  if (!bot) throw new ApiError(404, 'Бот не найден');
  return bot;
}

async function createBot({ name, api_url, comment }, currentUser) {
  if (!name || !api_url) throw new ApiError(400, 'Название и API URL обязательны');
  if (name.length < 2) throw new ApiError(400, 'Название должно содержать минимум 2 символа');

  const existing = await playersCol().findOne({ type: 'bot', name });
  if (existing) throw new ApiError(409, 'Бот с таким названием уже существует');

  const now = new Date();
  const apiKey = newApiKey();
  const result = await playersCol().insertOne({
    type: 'bot',
    name,
    api_url,
    api_key: apiKey,
    status: 'draft',
    comment: comment || '',
    created_at: now,
    updated_at: now,
    stats: zeroStats(),
    status_history: [{
      changed_at: now,
      old_status: null,
      new_status: 'draft',
      changed_by: new ObjectId(currentUser.id),
      reason: 'Создание бота'
    }]
  });

  const created = await playersCol().findOne({ _id: result.insertedId });
  return { ...created, api_key_plain: apiKey };
}

async function regenerateApiKey(id) {
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'Некорректный ID');
  const bot = await playersCol().findOne({ _id: new ObjectId(id), type: 'bot' });
  if (!bot) throw new ApiError(404, 'Бот не найден');
  const apiKey = newApiKey();
  await playersCol().updateOne(
    { _id: bot._id },
    { $set: { api_key: apiKey, updated_at: new Date() } }
  );
  return { _id: bot._id, name: bot.name, api_key: apiKey };
}

async function updateBot(id, body, currentUser) {
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'Некорректный ID');
  const bot = await playersCol().findOne({ _id: new ObjectId(id), type: 'bot' });
  if (!bot) throw new ApiError(404, 'Бот не найден');

  const { name, api_url, comment, status, reason } = body;
  const updates = { updated_at: new Date() };
  const pushOps = {};

  if (name !== undefined) {
    if (name.length < 2) throw new ApiError(400, 'Название должно содержать минимум 2 символа');
    if (name !== bot.name) {
      const dup = await playersCol().findOne({
        type: 'bot', name, _id: { $ne: bot._id }
      });
      if (dup) throw new ApiError(409, 'Бот с таким названием уже существует');
    }
    updates.name = name;
  }
  if (api_url !== undefined) updates.api_url = api_url;
  if (comment !== undefined) updates.comment = comment;

  if (status !== undefined && status !== bot.status) {
    const validStatuses = ['draft', 'testing', 'active', 'disabled'];
    if (!validStatuses.includes(status)) throw new ApiError(400, 'Недопустимый статус');
    updates.status = status;
    pushOps.status_history = {
      changed_at: new Date(),
      old_status: bot.status,
      new_status: status,
      changed_by: new ObjectId(currentUser.id),
      reason: reason || 'Изменение статуса'
    };
  }

  const updateQuery = { $set: updates };
  if (Object.keys(pushOps).length > 0) updateQuery.$push = pushOps;

  await playersCol().updateOne({ _id: bot._id }, updateQuery);
  return playersCol().findOne({ _id: bot._id });
}

async function deleteBot(id) {
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'Некорректный ID');
  const bot = await playersCol().findOne({ _id: new ObjectId(id), type: 'bot' });
  if (!bot) throw new ApiError(404, 'Бот не найден');

  const activeGame = await gamesCol().findOne({
    status: { $in: ['created', 'in_progress'] },
    $or: [{ player1_id: bot._id }, { player2_id: bot._id }]
  });
  if (activeGame) throw new ApiError(409, 'Нельзя удалить бота с активными партиями');

  await playersCol().deleteOne({ _id: bot._id });
  return { message: 'Бот удалён' };
}

module.exports = { listBots, getBotById, createBot, updateBot, deleteBot, regenerateApiKey };
