const { ObjectId } = require('mongodb');
const { gamesCol } = require('../models/gameModel');
const { playersCol } = require('../models/playerModel');
const { loadPlayerNames } = require('../utils/enrich');
const ApiError = require('../utils/ApiError');

function applyDateRangeFilter(filter, key, from, to) {
  if (from || to) {
    filter[key] = {};
    if (from) filter[key].$gte = new Date(from);
    if (to) filter[key].$lte = new Date(to + 'T23:59:59Z');
  }
}

async function listGames(q) {
  const filter = {};
  if (q.mode) filter.mode = q.mode;
  if (q.status) filter.status = q.status;
  if (q.result) filter.result = q.result;
  if (q.comment) filter.comment = { $regex: q.comment, $options: 'i' };
  applyDateRangeFilter(filter, 'created_at', q.created_from, q.created_to);
  applyDateRangeFilter(filter, 'updated_at', q.updated_from, q.updated_to);

  if (q.player_name) {
    const matching = await playersCol().find({
      $or: [
        { type: 'player', username: { $regex: q.player_name, $options: 'i' } },
        { type: 'bot', name: { $regex: q.player_name, $options: 'i' } }
      ]
    }).project({ _id: 1 }).toArray();

    const ids = matching.map(p => p._id);
    if (ids.length === 0) {
      return { data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } };
    }
    filter.$or = [{ player1_id: { $in: ids } }, { player2_id: { $in: ids } }];
  }

  const pageNum = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));
  const skip = (pageNum - 1) * limit;
  const sortField = q.sort_by || 'created_at';
  const sortDirection = q.sort_dir === 'asc' ? 1 : -1;

  const pipeline = [
    { $match: filter },
    { $addFields: { moves_count: { $size: '$moves' } } }
  ];
  if (q.moves_min || q.moves_max) {
    const m = {};
    if (q.moves_min) m.$gte = parseInt(q.moves_min);
    if (q.moves_max) m.$lte = parseInt(q.moves_max);
    pipeline.push({ $match: { moves_count: m } });
  }

  const countPipeline = [...pipeline, { $count: 'total' }];
  const countResult = await gamesCol().aggregate(countPipeline).toArray();
  const total = countResult.length > 0 ? countResult[0].total : 0;

  pipeline.push(
    { $sort: { [sortField]: sortDirection } },
    { $skip: skip },
    { $limit: limit },
    { $project: { moves: 0 } }
  );
  const games = await gamesCol().aggregate(pipeline).toArray();

  const ids = [];
  games.forEach(g => {
    ids.push(g.player1_id, g.player2_id);
    if (g.winner_id) ids.push(g.winner_id);
  });
  const map = await loadPlayerNames(ids);

  const enriched = games.map(g => ({
    ...g,
    player1_name: map[g.player1_id.toString()] || 'Неизвестен',
    player2_name: map[g.player2_id.toString()] || 'Неизвестен',
    winner_name: g.winner_id ? (map[g.winner_id.toString()] || 'Неизвестен') : null
  }));

  return {
    data: enriched,
    pagination: { page: pageNum, limit, total, pages: Math.ceil(total / limit) }
  };
}

async function getGameById(id) {
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'Некорректный ID');
  const game = await gamesCol().findOne({ _id: new ObjectId(id) });
  if (!game) throw new ApiError(404, 'Партия не найдена');

  const ids = [game.player1_id, game.player2_id];
  if (game.winner_id) ids.push(game.winner_id);
  game.moves.forEach(m => ids.push(m.player_id));
  game.status_history.forEach(h => h.changed_by && ids.push(h.changed_by));

  const map = await loadPlayerNames(ids);

  return {
    ...game,
    player1_name: map[game.player1_id.toString()] || 'Неизвестен',
    player2_name: map[game.player2_id.toString()] || 'Неизвестен',
    winner_name: game.winner_id ? (map[game.winner_id.toString()] || 'Неизвестен') : null,
    moves: game.moves.map(m => ({
      ...m,
      player_name: map[m.player_id.toString()] || 'Неизвестен'
    })),
    status_history: game.status_history.map(h => ({
      ...h,
      changed_by_name: h.changed_by ? (map[h.changed_by.toString()] || 'Неизвестен') : null
    }))
  };
}

async function getGameStatusHistory(id) {
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'Некорректный ID');
  const game = await gamesCol().findOne(
    { _id: new ObjectId(id) },
    { projection: { status_history: 1, created_at: 1 } }
  );
  if (!game) throw new ApiError(404, 'Партия не найдена');

  const changerIds = game.status_history.filter(h => h.changed_by).map(h => h.changed_by);
  const map = await loadPlayerNames(changerIds);

  return {
    entity_type: 'game',
    entity_name: `Партия от ${game.created_at ? new Date(game.created_at).toLocaleDateString('ru-RU') : ''}`,
    history: game.status_history.map(h => ({
      ...h,
      changed_by_name: h.changed_by ? (map[h.changed_by.toString()] || 'Неизвестен') : null
    }))
  };
}

async function getGameForEdit(id) {
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'Некорректный ID');
  const game = await gamesCol().findOne({ _id: new ObjectId(id) });
  if (!game) throw new ApiError(404, 'Партия не найдена');

  const players = await playersCol().find(
    {},
    { projection: { username: 1, name: 1, type: 1, status: 1 } }
  ).sort({ type: 1, username: 1, name: 1 }).toArray();

  return { game, players };
}

async function createGame({ mode, player1_id, player2_id, comment }, currentUser) {
  if (!mode || !player1_id || !player2_id) throw new ApiError(400, 'Режим и оба участника обязательны');
  if (!['hotseat', 'bot'].includes(mode)) throw new ApiError(400, 'Недопустимый режим игры');
  if (!ObjectId.isValid(player1_id) || !ObjectId.isValid(player2_id)) {
    throw new ApiError(400, 'Некорректные ID участников');
  }
  if (player1_id === player2_id) throw new ApiError(400, 'Участники должны быть разными');

  const p1 = await playersCol().findOne({ _id: new ObjectId(player1_id) });
  const p2 = await playersCol().findOne({ _id: new ObjectId(player2_id) });
  if (!p1 || !p2) throw new ApiError(404, 'Один или оба участника не найдены');

  if (mode === 'bot' && !(p1.type === 'bot' || p2.type === 'bot')) {
    throw new ApiError(400, 'В режиме "bot" один из участников должен быть ботом');
  }

  const now = new Date();
  const result = await gamesCol().insertOne({
    mode,
    status: 'created',
    player1_id: new ObjectId(player1_id),
    player2_id: new ObjectId(player2_id),
    winner_id: null,
    result: null,
    comment: comment || '',
    created_at: now,
    updated_at: now,
    moves: [],
    status_history: [{
      changed_at: now,
      old_status: null,
      new_status: 'created',
      changed_by: new ObjectId(currentUser.id),
      reason: 'Создание партии'
    }]
  });

  const game = await gamesCol().findOne({ _id: result.insertedId });
  const p1name = p1.type === 'player' ? p1.username : p1.name;
  const p2name = p2.type === 'player' ? p2.username : p2.name;
  return { ...game, player1_name: p1name, player2_name: p2name, winner_name: null };
}

async function updateGame(id, body, currentUser) {
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'Некорректный ID');
  const gameId = new ObjectId(id);
  const game = await gamesCol().findOne({ _id: gameId });
  if (!game) throw new ApiError(404, 'Партия не найдена');

  const isAdmin = currentUser.role === 'admin';
  const isParticipant = game.player1_id.toString() === currentUser.id ||
                        game.player2_id.toString() === currentUser.id;
  if (!isAdmin && !isParticipant) {
    throw new ApiError(403, 'Только участники партии или администратор могут редактировать партию');
  }

  const { mode, status, player1_id, player2_id, winner_id, result, comment, reason } = body;
  const validModes = ['hotseat', 'bot'];
  const validStatuses = ['created', 'in_progress', 'completed', 'paused', 'abandoned'];
  const validResults = ['checkmate', 'stalemate', 'draw', 'resignation', 'timeout', null, ''];

  if (mode && !validModes.includes(mode)) throw new ApiError(400, 'Недопустимый режим игры');
  if (status && !validStatuses.includes(status)) throw new ApiError(400, 'Недопустимый статус');
  if (result && !validResults.includes(result)) throw new ApiError(400, 'Недопустимый результат');

  if (player1_id) {
    const p1 = await playersCol().findOne({ _id: new ObjectId(player1_id) });
    if (!p1) throw new ApiError(400, 'Игрок 1 не найден');
  }
  if (player2_id) {
    const p2 = await playersCol().findOne({ _id: new ObjectId(player2_id) });
    if (!p2) throw new ApiError(400, 'Игрок 2 не найден');
  }
  if (winner_id && winner_id !== 'null' && winner_id !== '') {
    const w = await playersCol().findOne({ _id: new ObjectId(winner_id) });
    if (!w) throw new ApiError(400, 'Победитель не найден');

    const effectiveP1 = player1_id || game.player1_id.toString();
    const effectiveP2 = player2_id || game.player2_id.toString();
    if (winner_id !== effectiveP1 && winner_id !== effectiveP2) {
      throw new ApiError(400, 'Победитель должен быть одним из участников партии');
    }
  }

  const updateFields = { updated_at: new Date() };
  if (mode) updateFields.mode = mode;
  if (status) updateFields.status = status;
  if (player1_id) updateFields.player1_id = new ObjectId(player1_id);
  if (player2_id) updateFields.player2_id = new ObjectId(player2_id);
  if (winner_id === 'null' || winner_id === '') {
    updateFields.winner_id = null;
  } else if (winner_id) {
    updateFields.winner_id = new ObjectId(winner_id);
  }
  if (result !== undefined) updateFields.result = result || null;
  if (comment !== undefined) updateFields.comment = comment;

  const updateOps = { $set: updateFields };
  if (status && status !== game.status) {
    updateOps.$push = {
      status_history: {
        changed_at: new Date(),
        old_status: game.status,
        new_status: status,
        changed_by: new ObjectId(currentUser.id),
        reason: reason || 'Редактирование партии'
      }
    };
  }

  await gamesCol().updateOne({ _id: gameId }, updateOps);
  return { message: 'Партия обновлена' };
}

async function deleteGame(id) {
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'Некорректный ID');
  const gameId = new ObjectId(id);
  const game = await gamesCol().findOne({ _id: gameId });
  if (!game) throw new ApiError(404, 'Партия не найдена');
  if (game.status === 'in_progress') {
    throw new ApiError(400, 'Нельзя удалить партию в процессе. Сначала завершите или прервите её.');
  }
  await gamesCol().deleteOne({ _id: gameId });
  return { message: 'Партия удалена' };
}

async function listParticipants({ type } = {}) {
  const filter = { status: 'active' };
  if (type) filter.type = type;
  const participants = await playersCol().find(filter)
    .project({ username: 1, name: 1, type: 1 })
    .sort({ type: 1, username: 1, name: 1 })
    .toArray();
  return participants.map(p => ({
    _id: p._id,
    display_name: p.type === 'player' ? p.username : `🤖 ${p.name}`,
    type: p.type
  }));
}

module.exports = {
  listGames, getGameById, getGameStatusHistory, getGameForEdit,
  createGame, updateGame, deleteGame, listParticipants
};
