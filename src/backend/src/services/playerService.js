const { ObjectId } = require('mongodb');
const { playersCol } = require('../models/playerModel');
const { gamesCol } = require('../models/gameModel');
const { ccGamesCol } = require('../models/circularChessModel');
const { loadPlayerNames } = require('../utils/enrich');
const { BASE_ELO, updateRatings, expectedScore, eloTitle } = require('../utils/elo');
const ApiError = require('../utils/ApiError');

const COUNTED_STATUSES = ['checkmate', 'stalemate', 'resigned', 'draw'];

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

async function listPlayers(query) {
  const {
    username, email, status, comment,
    wins_min, wins_max, losses_min, losses_max,
    draws_min, draws_max, total_min, total_max,
    elo_min, elo_max,
    created_from, created_to,
    sort_by, sort_dir,
    page, limit: lim
  } = query;

  const filter = { type: 'player' };
  if (username) filter.username = { $regex: username, $options: 'i' };
  if (email) filter.email = { $regex: email, $options: 'i' };
  if (status) filter.status = status;
  if (comment) filter.comment = { $regex: comment, $options: 'i' };

  applyRangeFilter(filter, 'stats.wins', wins_min, wins_max);
  applyRangeFilter(filter, 'stats.losses', losses_min, losses_max);
  applyRangeFilter(filter, 'stats.draws', draws_min, draws_max);
  applyRangeFilter(filter, 'stats.total_games', total_min, total_max);
  applyRangeFilter(filter, 'stats.elo', elo_min, elo_max);
  applyDateRangeFilter(filter, 'created_at', created_from, created_to);

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(lim) || 20));
  const skip = (pageNum - 1) * limit;

  const sortField = sort_by || 'created_at';
  const sortDirection = sort_dir === 'asc' ? 1 : -1;

  const [players, total] = await Promise.all([
    playersCol().find(filter).project({ password_hash: 0 })
      .sort({ [sortField]: sortDirection }).skip(skip).limit(limit).toArray(),
    playersCol().countDocuments(filter)
  ]);

  return {
    data: players,
    pagination: { page: pageNum, limit, total, pages: Math.ceil(total / limit) }
  };
}

async function getPlayerById(id) {
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'Некорректный ID');
  const player = await playersCol().findOne(
    { _id: new ObjectId(id), type: 'player' },
    { projection: { password_hash: 0 } }
  );
  if (!player) throw new ApiError(404, 'Игрок не найден');
  return player;
}

async function getPlayerGames(id, query) {
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'Некорректный ID');
  const playerId = new ObjectId(id);
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
  const skip = (page - 1) * limit;

  const filter = { $or: [{ player1_id: playerId }, { player2_id: playerId }] };
  if (query.mode) filter.mode = query.mode;
  if (query.status) filter.status = query.status;
  if (query.result) filter.result = query.result;
  applyDateRangeFilter(filter, 'created_at', query.created_from, query.created_to);

  const pipeline = [
    { $match: filter },
    { $addFields: { moves_count: { $size: '$moves' } } },
    { $sort: { created_at: -1 } },
    { $skip: skip },
    { $limit: limit },
    { $project: { moves: 0 } }
  ];
  const countPipeline = [{ $match: filter }, { $count: 'total' }];

  const [games, countResult] = await Promise.all([
    gamesCol().aggregate(pipeline).toArray(),
    gamesCol().aggregate(countPipeline).toArray()
  ]);
  const total = countResult.length > 0 ? countResult[0].total : 0;

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
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  };
}

async function getStatusHistory(id) {
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'Некорректный ID');
  const player = await playersCol().findOne(
    { _id: new ObjectId(id) },
    { projection: { status_history: 1, username: 1, name: 1, type: 1 } }
  );
  if (!player) throw new ApiError(404, 'Участник не найден');

  const changerIds = player.status_history.filter(h => h.changed_by).map(h => h.changed_by);
  const map = await loadPlayerNames(changerIds);

  return {
    entity_name: player.type === 'player' ? player.username : player.name,
    entity_type: player.type,
    history: player.status_history.map(h => ({
      ...h,
      changed_by_name: h.changed_by ? (map[h.changed_by.toString()] || 'Неизвестен') : null
    }))
  };
}

async function updatePlayer(id, body, currentUser) {
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'Некорректный ID');

  const player = await playersCol().findOne({ _id: new ObjectId(id), type: 'player' });
  if (!player) throw new ApiError(404, 'Игрок не найден');

  const isSelf = currentUser.id === id;
  const isAdmin = currentUser.role === 'admin';
  if (!isSelf && !isAdmin) throw new ApiError(403, 'Нет прав на изменение этого игрока');
  if (isAdmin && !isSelf && player.role === 'admin') throw new ApiError(403, 'Нельзя редактировать другого администратора');

  const { comment, status, reason, username, email } = body;
  const updates = { updated_at: new Date() };
  const pushOps = {};

  if (comment !== undefined) updates.comment = comment;

  if (username !== undefined && username !== player.username) {
    if (!isSelf && !isAdmin) throw new ApiError(403, 'Нельзя изменить чужой логин');
    if (username.length < 3) throw new ApiError(400, 'Логин должен содержать минимум 3 символа');
    const dup = await playersCol().findOne({
      type: 'player', username, _id: { $ne: player._id }
    });
    if (dup) throw new ApiError(409, 'Этот логин уже используется');
    updates.username = username;
  }

  if (email !== undefined && email !== player.email) {
    if (!isSelf && !isAdmin) throw new ApiError(403, 'Нельзя изменить чужой email');
    const dup = await playersCol().findOne({
      type: 'player', email, _id: { $ne: player._id }
    });
    if (dup) throw new ApiError(409, 'Этот email уже используется');
    updates.email = email;
  }

  if (status !== undefined && status !== player.status) {
    if (!isAdmin) throw new ApiError(403, 'Изменение статуса доступно только администраторам');
    const validStatuses = ['active', 'banned', 'deleted'];
    if (!validStatuses.includes(status)) throw new ApiError(400, 'Недопустимый статус');
    updates.status = status;
    pushOps.status_history = {
      changed_at: new Date(),
      old_status: player.status,
      new_status: status,
      changed_by: new ObjectId(currentUser.id),
      reason: reason || 'Изменение статуса'
    };
  }

  const updateQuery = { $set: updates };
  if (Object.keys(pushOps).length > 0) updateQuery.$push = pushOps;

  await playersCol().updateOne({ _id: player._id }, updateQuery);
  return playersCol().findOne(
    { _id: player._id },
    { projection: { password_hash: 0 } }
  );
}

async function getEloHistory(id, query) {
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'Некорректный ID');
  const playerId = new ObjectId(id);

  const player = await playersCol().findOne({ _id: playerId }, { projection: { stats: 1, username: 1, name: 1 } });
  if (!player) throw new ApiError(404, 'Игрок не найден');

  const games = await ccGamesCol().find({
    status: { $in: COUNTED_STATUSES }
  }).sort({ created_at: 1, _id: 1 }).toArray();

  const ratings = {};
  const ratingOf = (pid) => {
    const k = pid.toString();
    if (ratings[k] === undefined) ratings[k] = BASE_ELO;
    return ratings[k];
  };

  const history = [];
  for (const g of games) {
    const w = g.white_id.toString();
    const b = g.black_id.toString();
    const whiteElo = ratingOf(g.white_id);
    const blackElo = ratingOf(g.black_id);
    let whiteScore;
    if (g.winner_id) {
      whiteScore = g.winner_id.toString() === w ? 1 : 0;
    } else {
      whiteScore = 0.5;
    }
    const { whiteNew, blackNew } = updateRatings(whiteElo, blackElo, whiteScore);
    ratings[w] = whiteNew;
    ratings[b] = blackNew;

    const pidStr = playerId.toString();
    if (w === pidStr || b === pidStr) {
      const isWhite = w === pidStr;
      const myBefore = isWhite ? whiteElo : blackElo;
      const myAfter = isWhite ? whiteNew : blackNew;
      const oppBefore = isWhite ? blackElo : whiteElo;
      const oppId = isWhite ? g.black_id : g.white_id;
      const myScore = isWhite ? whiteScore : 1 - whiteScore;
      const exp = expectedScore(myBefore, oppBefore);
      const outcome = myScore === 1 ? 'win' : myScore === 0 ? 'loss' : 'draw';
      history.push({
        game_id: g._id,
        opponent_id: oppId,
        opponent_elo_before: oppBefore,
        color: isWhite ? 'w' : 'b',
        outcome,
        my_score: myScore,
        expected_score: Math.round(exp * 1000) / 1000,
        elo_before: myBefore,
        elo_after: myAfter,
        elo_delta: myAfter - myBefore,
        played_at: g.updated_at
      });
    }
  }

  const limit = Math.min(500, Math.max(1, parseInt(query.limit) || 20));
  const recent = history.slice(-limit).reverse();

  const oppIds = recent.map(h => h.opponent_id);
  const names = await loadPlayerNames(oppIds);
  const enriched = recent.map(h => ({
    ...h,
    opponent_name: names[h.opponent_id.toString()] || 'Неизвестен'
  }));

  const currentElo = (player.stats && player.stats.elo) || BASE_ELO;
  return {
    current_elo: currentElo,
    title: eloTitle(currentElo),
    base_elo: BASE_ELO,
    games_counted: history.length,
    history: enriched
  };
}

module.exports = {
  listPlayers, getPlayerById, getPlayerGames, getStatusHistory, updatePlayer, getEloHistory
};
