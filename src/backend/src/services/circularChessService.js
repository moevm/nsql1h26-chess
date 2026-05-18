const { ObjectId } = require('mongodb');
const { ccGamesCol } = require('../models/circularChessModel');
const { playersCol } = require('../models/playerModel');
const { loadPlayerNames } = require('../utils/enrich');
const ApiError = require('../utils/ApiError');
const cc = require('../game/circular-chess');

const TERMINAL_STATUSES = new Set(['checkmate', 'stalemate', 'threefold', 'resigned', 'draw', 'abandoned']);

function actorId(actor) {
  if (!actor) return null;
  if (actor._id) return actor._id.toString();
  if (actor.id) return actor.id.toString();
  return null;
}

function loadEngine(game) {
  return cc.Engine.fromSnapshot({
    fen: game.fen,
    positionCounts: game.position_counts || {}
  });
}

function summary(game, names) {
  return {
    _id: game._id,
    status: game.status,
    white_id: game.white_id,
    black_id: game.black_id,
    white_name: names ? names[game.white_id.toString()] : null,
    black_name: names ? names[game.black_id.toString()] : null,
    winner_id: game.winner_id || null,
    result: game.result || null,
    turn: game.turn,
    move_number: game.move_number,
    fen: game.fen,
    hotseat: !!game.hotseat,
    comment: game.comment || '',
    created_at: game.created_at,
    updated_at: game.updated_at
  };
}

function buildDateRange(from, to) {
  const r = {};
  if (from) r.$gte = new Date(from);
  if (to) r.$lte = new Date(to + 'T23:59:59Z');
  return Object.keys(r).length ? r : null;
}

// Аккуратно «домножаем» уже существующий $or через $and, чтобы
// фильтр по имени игрока не вытеснил фильтр по player_id и наоборот.
function andOr(filter, clause) {
  if (filter.$or) {
    filter.$and = (filter.$and || []).concat([{ $or: filter.$or }, clause]);
    delete filter.$or;
  } else if (filter.$and) {
    filter.$and.push(clause);
  } else {
    Object.assign(filter, clause);
  }
}

async function listGames(q) {
  const filter = {};
  if (q.status) filter.status = q.status;
  if (q.active === '1' || q.active === 'true') {
    filter.status = { $in: ['active', 'check'] };
  }
  if (q.player_id && ObjectId.isValid(q.player_id)) {
    const id = new ObjectId(q.player_id);
    filter.$or = [{ white_id: id }, { black_id: id }];

    // Исход с точки зрения этого игрока (work только в паре с player_id).
    if (q.outcome === 'win') {
      filter.winner_id = id;
    } else if (q.outcome === 'loss') {
      andOr(filter, { winner_id: { $nin: [null, id] } });
    } else if (q.outcome === 'draw') {
      filter.winner_id = null;
      filter.status = { $in: ['stalemate', 'threefold', 'draw'] };
    } else if (q.outcome === 'active') {
      filter.status = { $in: ['active', 'check'] };
    }
  }

  const page = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));

  // Поиск по имени участника: игроки хранят имя в `username`, боты — в `name`.
  if (q.player_name && String(q.player_name).trim()) {
    const term = String(q.player_name).trim();
    const matched = await playersCol().find(
      {
        $or: [
          { type: 'player', username: { $regex: term, $options: 'i' } },
          { type: 'bot', name: { $regex: term, $options: 'i' } }
        ]
      },
      { projection: { _id: 1 } }
    ).limit(500).toArray();
    const ids = matched.map(p => p._id);
    if (!ids.length) {
      return { data: [], pagination: { page, limit, total: 0, pages: 0 } };
    }
    andOr(filter, { $or: [{ white_id: { $in: ids } }, { black_id: { $in: ids } }] });
  }

  const movesRange = {};
  if (q.moves_min) movesRange.$gte = parseInt(q.moves_min);
  if (q.moves_max) movesRange.$lte = parseInt(q.moves_max);
  if (Object.keys(movesRange).length) filter.move_number = movesRange;

  const createdR = buildDateRange(q.created_from, q.created_to);
  if (createdR) filter.created_at = createdR;
  const updatedR = buildDateRange(q.updated_from, q.updated_to);
  if (updatedR) filter.updated_at = updatedR;

  if (q.comment && String(q.comment).trim()) {
    filter.comment = { $regex: String(q.comment).trim(), $options: 'i' };
  }

  const skip = (page - 1) * limit;

  const total = await ccGamesCol().countDocuments(filter);
  const games = await ccGamesCol()
    .find(filter, { projection: { moves: 0, position_counts: 0 } })
    .sort({ updated_at: -1 })
    .skip(skip).limit(limit)
    .toArray();

  const ids = [];
  games.forEach(g => { ids.push(g.white_id, g.black_id); });
  const names = await loadPlayerNames(ids);

  return {
    data: games.map(g => summary(g, names)),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  };
}

async function getGame(id, { includeMoves = true } = {}) {
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'Некорректный ID');
  const game = await ccGamesCol().findOne({ _id: new ObjectId(id) });
  if (!game) throw new ApiError(404, 'Партия не найдена');
  const names = await loadPlayerNames([game.white_id, game.black_id, game.winner_id].filter(Boolean));
  const out = summary(game, names);
  if (includeMoves) out.moves = game.moves;
  return out;
}

async function getLegalMoves(id, from) {
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'Некорректный ID');
  const game = await ccGamesCol().findOne(
    { _id: new ObjectId(id) },
    { projection: { fen: 1, status: 1, position_counts: 1 } }
  );
  if (!game) throw new ApiError(404, 'Партия не найдена');
  if (TERMINAL_STATUSES.has(game.status)) return [];
  const engine = loadEngine(game);
  return engine.getLegalMoves(from || null);
}

async function createGame({ white_id, black_id, comment, hotseat }, currentUser) {
  if (!white_id || !black_id) throw new ApiError(400, 'Нужны white_id и black_id');
  if (!ObjectId.isValid(white_id) || !ObjectId.isValid(black_id)) {
    throw new ApiError(400, 'Некорректные ID участников');
  }
  if (!hotseat && white_id === black_id) {
    throw new ApiError(400, 'Участники должны быть разными (для одного устройства включите hotseat)');
  }

  const [white, black] = await Promise.all([
    playersCol().findOne({ _id: new ObjectId(white_id) }),
    playersCol().findOne({ _id: new ObjectId(black_id) })
  ]);
  if (!white || !black) throw new ApiError(404, 'Один из участников не найден');
  if (white.status === 'banned' || black.status === 'banned') {
    throw new ApiError(400, 'Заблокированный участник не может играть');
  }

  const engine = new cc.Engine();
  const now = new Date();
  const initialFEN = engine.toFEN();
  const initialCounts = engine.getPositionCounts();

  const doc = {
    status: 'active',
    white_id: new ObjectId(white_id),
    black_id: new ObjectId(black_id),
    winner_id: null,
    result: null,
    fen: initialFEN,
    turn: 'w',
    move_number: 0,
    moves: [],
    position_counts: initialCounts,
    hotseat: !!hotseat,
    comment: comment || '',
    created_at: now,
    updated_at: now
  };
  if (currentUser) doc.created_by = new ObjectId(actorId(currentUser));

  const result = await ccGamesCol().insertOne(doc);
  return getGame(result.insertedId.toString());
}

async function makeMove(id, moveInput, actor) {
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'Некорректный ID');
  if (!moveInput) throw new ApiError(400, 'Нужно поле move');

  const _id = new ObjectId(id);
  const game = await ccGamesCol().findOne({ _id });
  if (!game) throw new ApiError(404, 'Партия не найдена');
  if (TERMINAL_STATUSES.has(game.status)) {
    throw new ApiError(409, 'Партия завершена');
  }

  const aId = actorId(actor);
  if (!aId) throw new ApiError(401, 'Не указан актор хода');
  if (!game.hotseat) {
    const expected = game.turn === 'w' ? game.white_id.toString() : game.black_id.toString();
    if (aId !== expected) {
      throw new ApiError(403, 'Сейчас не ваш ход');
    }
  } else {
    const isParticipant = aId === game.white_id.toString() || aId === game.black_id.toString();
    if (!isParticipant) {
      throw new ApiError(403, 'Хот-сит партия: ходить может только её владелец');
    }
  }

  const engine = loadEngine(game);

  let played;
  try {
    played = engine.move(moveInput);
  } catch (e) {
    throw new ApiError(400, e.message);
  }

  const newFEN = engine.toFEN();
  const newCounts = engine.getPositionCounts();
  const status = engine.getStatus();
  const now = new Date();
  const moveNumber = game.move_number + 1;

  const moveRecord = {
    number: moveNumber,
    color: game.turn,
    notation: played.notation,
    from: played.from,
    to: played.to,
    piece_type: played.piece && played.piece.type,
    captured: played.captured ? played.captured.type : null,
    promotion: played.promotion,
    is_castling: played.isCastling,
    is_en_passant: played.isEnPassant,
    is_check: status === 'check' || status === 'checkmate',
    is_checkmate: status === 'checkmate',
    fen_after: newFEN,
    played_by: new ObjectId(aId),
    played_at: now
  };

  let winnerId = null;
  let result = null;
  if (status === 'checkmate') {
    winnerId = game.turn === 'w' ? game.white_id : game.black_id;
    result = 'checkmate';
  } else if (status === 'stalemate' || status === 'threefold') {
    result = status === 'threefold' ? 'threefold' : 'stalemate';
  }

  const update = {
    $set: {
      status,
      fen: newFEN,
      turn: engine.getTurn(),
      move_number: moveNumber,
      position_counts: newCounts,
      updated_at: now,
      winner_id: winnerId,
      result
    },
    $push: { moves: moveRecord }
  };

  // Optimistic concurrency: only update if move_number hasn't advanced.
  const updated = await ccGamesCol().findOneAndUpdate(
    { _id, move_number: game.move_number, status: { $nin: Array.from(TERMINAL_STATUSES) } },
    update,
    { returnDocument: 'after' }
  );

  if (!updated) {
    throw new ApiError(409, 'Состояние партии изменилось, повторите запрос');
  }

  const names = await loadPlayerNames([updated.white_id, updated.black_id, winnerId].filter(Boolean));
  return {
    move: moveRecord,
    game: { ...summary(updated, names), moves: updated.moves }
  };
}

async function resignGame(id, actor) {
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'Некорректный ID');
  const _id = new ObjectId(id);
  const game = await ccGamesCol().findOne({ _id });
  if (!game) throw new ApiError(404, 'Партия не найдена');
  if (TERMINAL_STATUSES.has(game.status)) {
    throw new ApiError(409, 'Партия уже завершена');
  }
  const aId = actorId(actor);
  if (!aId) throw new ApiError(401, 'Не указан актор');
  const isWhite = aId === game.white_id.toString();
  const isBlack = aId === game.black_id.toString();
  if (!isWhite && !isBlack) throw new ApiError(403, 'Сдаться может только участник');

  const winnerId = isWhite ? game.black_id : game.white_id;
  await ccGamesCol().updateOne(
    { _id },
    {
      $set: {
        status: 'resigned',
        winner_id: winnerId,
        result: 'resignation',
        updated_at: new Date()
      }
    }
  );
  return getGame(id);
}

// Завершение партии без победителя: ничья по соглашению или прерывание.
async function endWithoutWinner(id, actor, { status, result }) {
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'Некорректный ID');
  const _id = new ObjectId(id);
  const game = await ccGamesCol().findOne({ _id });
  if (!game) throw new ApiError(404, 'Партия не найдена');
  if (TERMINAL_STATUSES.has(game.status)) {
    throw new ApiError(409, 'Партия уже завершена');
  }
  const aId = actorId(actor);
  if (!aId) throw new ApiError(401, 'Не указан актор');
  const isParticipant = aId === game.white_id.toString() || aId === game.black_id.toString();
  if (!isParticipant) throw new ApiError(403, 'Завершить партию может только её участник');

  await ccGamesCol().updateOne(
    { _id },
    {
      $set: {
        status,
        winner_id: null,
        result,
        updated_at: new Date()
      }
    }
  );
  return getGame(id);
}

async function drawGame(id, actor) {
  return endWithoutWinner(id, actor, { status: 'draw', result: 'draw' });
}

async function abandonGame(id, actor) {
  return endWithoutWinner(id, actor, { status: 'abandoned', result: 'abandoned' });
}

// Редактирование метаданных партии. Сейчас разрешено менять только comment,
// потому что статус/ход/результат — это игровое состояние, оно меняется
// движком или кнопками «Сдаться/Ничья/Покинуть».
async function updateGameMeta(id, actor, patch) {
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'Некорректный ID');
  const _id = new ObjectId(id);
  const game = await ccGamesCol().findOne({ _id });
  if (!game) throw new ApiError(404, 'Партия не найдена');

  const aId = actorId(actor);
  if (!aId) throw new ApiError(401, 'Не указан актор');
  const isParticipant = aId === game.white_id.toString() || aId === game.black_id.toString();
  const isAdmin = actor && actor.role === 'admin';
  if (!isParticipant && !isAdmin) {
    throw new ApiError(403, 'Редактировать партию может только её участник');
  }

  const $set = { updated_at: new Date() };
  if (typeof patch.comment === 'string') {
    if (patch.comment.length > 500) throw new ApiError(400, 'Комментарий слишком длинный');
    $set.comment = patch.comment;
  }

  if (Object.keys($set).length === 1) {
    // только updated_at — ничего не меняли
    return getGame(id);
  }

  await ccGamesCol().updateOne({ _id }, { $set });
  return getGame(id);
}

module.exports = {
  listGames, getGame, getLegalMoves, createGame, makeMove,
  resignGame, drawGame, abandonGame, updateGameMeta
};
