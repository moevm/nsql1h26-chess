// Скрипт-помощник: использует движок круговых шахмат, чтобы сгенерировать
// правдоподобные истории партий для seed-data.json.
//
// Запуск (один раз, при необходимости перегенерации):
//   node src/backend/src/db/generate-seed-games.js > /tmp/cc-seed.json
//
// Затем содержимое /tmp/cc-seed.json вставляется в seed-data.json вручную.
// Сам seed.js этот скрипт НЕ вызывает — он работает только с готовым JSON.

const cc = require('../game/circular-chess');

// Фиксированный сид для воспроизводимости.
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

function pickMove(rng, moves) {
  return moves[Math.floor(rng() * moves.length)];
}

function playRandomGame({ seed, maxPlies, stopOn }) {
  const engine = new cc.Engine();
  const rng = makeRng(seed);
  const moveHistory = [];
  let plies = 0;

  while (plies < maxPlies) {
    const status = engine.getStatus();
    if (stopOn && stopOn.has(status)) break;
    if (status === 'checkmate' || status === 'stalemate') break;

    const turn = engine.getTurn();
    const legal = engine.getLegalMoves();
    if (!legal.length) break;

    const chosen = pickMove(rng, legal);
    const before = engine.getMoveNumber();
    const played = engine.move({ from: chosen.from, to: chosen.to, promotion: chosen.promotion });

    const afterStatus = engine.getStatus();
    const fenAfter = engine.toFEN();

    moveHistory.push({
      number: before,
      color: turn,
      notation: `r${played.from.r}s${played.from.s}-r${played.to.r}s${played.to.s}` +
        (played.promotion ? `=${played.promotion}` : ''),
      from: played.from,
      to: played.to,
      piece_type: played.piece && played.piece.type,
      captured: played.captured ? played.captured.type : null,
      promotion: played.promotion || null,
      is_castling: !!played.isCastling,
      is_en_passant: !!played.isEnPassant,
      is_check: afterStatus === 'check' || afterStatus === 'checkmate',
      is_checkmate: afterStatus === 'checkmate',
      fen_after: fenAfter
    });

    plies++;
  }

  return {
    fen: engine.toFEN(),
    turn: engine.getTurn(),
    moveNumber: engine.getMoveNumber(),
    positionCounts: engine.getPositionCounts(),
    moves: moveHistory,
    finalStatus: engine.getStatus()
  };
}

// Спецификации партий: для каждой задаём желаемый статус и доп. поля.
// player1 = белые, player2 = чёрные. ID — из seed-data.json.
const PLAYERS = {
  admin:        '000000000000000000000001',
  player1:      '000000000000000000000002',
  ivanov:       '000000000000000000000003',
  petrova:      '000000000000000000000004',
  sidorov:      '000000000000000000000005',
  kuznetsov:    '000000000000000000000006',
  smirnova:     '000000000000000000000007',
  fedorov:      '000000000000000000000008',
  random_bot:   '000000000000000000000101',
  minimax_bot:  '000000000000000000000103'
};

function pid(name) {
  if (!PLAYERS[name]) throw new Error('Unknown player alias: ' + name);
  return PLAYERS[name];
}

const SPECS = [
  // 1. Идёт партия — несколько ходов сыграно
  {
    seed: 7,
    plies: 12,
    status: 'active',
    white: 'player1', black: 'ivanov',
    hotseat: true,
    comment: 'Активная партия, дебют разыгран',
    created_at: '2026-05-16T10:00:00Z',
    updated_at: '2026-05-16T10:18:00Z'
  },
  // 2. Идёт партия (только-только началась)
  {
    seed: 19,
    plies: 4,
    status: 'active',
    white: 'fedorov', black: 'sidorov',
    hotseat: true,
    comment: 'Партия только что началась',
    created_at: '2026-05-17T09:00:00Z',
    updated_at: '2026-05-17T09:03:00Z'
  },
  // 3. Шах
  {
    seed: 42,
    plies: 200,
    stopOn: 'check',
    status: 'check',
    white: 'smirnova', black: 'petrova',
    hotseat: true,
    comment: 'Чёрному королю объявлен шах',
    created_at: '2026-05-15T14:00:00Z',
    updated_at: '2026-05-15T14:25:00Z'
  },
  // 4. Мат
  {
    seed: 9,
    plies: 200,
    stopOn: 'checkmate',
    status: 'checkmate',
    result: 'checkmate',
    white: 'admin', black: 'kuznetsov',
    hotseat: false,
    comment: 'Партия с матом',
    created_at: '2026-05-14T11:00:00Z',
    updated_at: '2026-05-14T12:30:00Z'
  },
  // 5. Пат
  {
    seed: 256,
    plies: 800,
    stopOn: 'stalemate',
    status: 'stalemate',
    result: 'stalemate',
    white: 'ivanov', black: 'fedorov',
    hotseat: true,
    comment: 'Партия завершилась патом',
    created_at: '2026-05-13T15:00:00Z',
    updated_at: '2026-05-13T16:45:00Z',
    fallbackStatus: 'stalemate' // если не дошли до пата — пометим вручную
  },
  // 6. Сдача
  {
    seed: 88,
    plies: 22,
    status: 'resigned',
    result: 'resignation',
    winner: 'white',
    white: 'smirnova', black: 'sidorov',
    hotseat: true,
    comment: 'Чёрные сдались',
    created_at: '2026-05-12T13:00:00Z',
    updated_at: '2026-05-12T13:35:00Z'
  },
  // 7. Ничья по соглашению
  {
    seed: 11,
    plies: 30,
    status: 'draw',
    result: 'draw',
    white: 'petrova', black: 'ivanov',
    hotseat: true,
    comment: 'Ничья по соглашению',
    created_at: '2026-05-11T16:00:00Z',
    updated_at: '2026-05-11T16:42:00Z'
  },
  // 8. Партия покинута (abandoned)
  {
    seed: 5,
    plies: 6,
    status: 'abandoned',
    result: 'abandoned',
    white: 'player1', black: 'admin',
    hotseat: false,
    comment: 'Партия прервана участником',
    created_at: '2026-05-10T18:00:00Z',
    updated_at: '2026-05-10T18:08:00Z'
  },
  // 9. Партия игрок vs бот, идёт
  {
    seed: 33,
    plies: 9,
    status: 'active',
    white: 'player1', black: 'random_bot',
    hotseat: false,
    comment: 'Игрок vs RandomBot — ждёт хода бота',
    created_at: '2026-05-17T12:00:00Z',
    updated_at: '2026-05-17T12:11:00Z'
  },
  // 10. Игрок vs MinimaxBot — мат боту (белые ставят мат)
  {
    seed: 15,
    plies: 200,
    stopOn: 'checkmate',
    status: 'checkmate',
    result: 'checkmate',
    white: 'smirnova', black: 'minimax_bot',
    hotseat: false,
    comment: 'Игрок поставил мат MinimaxBot',
    created_at: '2026-05-09T10:00:00Z',
    updated_at: '2026-05-09T11:05:00Z',
    fallbackStatus: 'resigned',
    fallbackResult: 'resignation'
  }
];

function buildGame(spec) {
  const stopOnSet = spec.stopOn ? new Set([spec.stopOn]) : null;
  const result = playRandomGame({ seed: spec.seed, maxPlies: spec.plies, stopOn: stopOnSet });

  let finalStatus = spec.status;
  let finalResult = spec.result || null;

  // Если запрашивали мат/пат, но движок не дошёл — используем fallback.
  if (spec.stopOn && result.finalStatus !== spec.stopOn) {
    if (spec.fallbackStatus) {
      finalStatus = spec.fallbackStatus;
      finalResult = spec.fallbackResult || null;
    } else {
      finalStatus = spec.status; // оставляем как просили (валидно по схеме)
    }
  } else if (spec.stopOn) {
    finalStatus = result.finalStatus;
  }

  let winnerName = null;
  if (finalStatus === 'checkmate') {
    const lastMove = result.moves[result.moves.length - 1];
    winnerName = lastMove && lastMove.color === 'w' ? spec.white : spec.black;
  } else if (finalStatus === 'resigned' && spec.winner) {
    winnerName = spec.winner === 'white' ? spec.white : spec.black;
  }
  const winnerId = winnerName ? pid(winnerName) : null;

  // Корректируем поле `played_by` и `played_at` для каждого хода (равномерное распределение по времени).
  const t0 = new Date(spec.created_at).getTime();
  const t1 = new Date(spec.updated_at).getTime();
  const step = result.moves.length > 0 ? (t1 - t0) / (result.moves.length + 1) : 0;
  const moves = result.moves.map((m, i) => ({
    ...m,
    played_by: pid(m.color === 'w' ? spec.white : spec.black),
    played_at: new Date(t0 + step * (i + 1)).toISOString()
  }));

  return {
    status: finalStatus,
    white_id: pid(spec.white),
    black_id: pid(spec.black),
    winner_id: winnerId,
    result: finalResult,
    fen: result.fen,
    turn: result.turn,
    move_number: result.moveNumber - 1, // moveNumber начинается с 1, число сделанных ходов = moves.length
    moves,
    position_counts: result.positionCounts,
    hotseat: !!spec.hotseat,
    comment: spec.comment,
    created_at: spec.created_at,
    updated_at: spec.updated_at
  };
}

const games = SPECS.map(buildGame).map(g => ({
  ...g,
  move_number: g.moves.length
}));

// Конвертируем в формат extended JSON (BSON.EJSON), чтобы seed.js мог распарсить.
function toEJSON(obj) {
  return JSON.parse(JSON.stringify(obj, (key, value) => value));
}

function toExtended(game) {
  const ej = (v) => v;
  return {
    status: game.status,
    white_id: { $oid: game.white_id },
    black_id: { $oid: game.black_id },
    winner_id: game.winner_id ? { $oid: game.winner_id } : null,
    result: game.result,
    fen: game.fen,
    turn: game.turn,
    move_number: { $numberInt: String(game.move_number) },
    moves: game.moves.map(m => ({
      number: { $numberInt: String(m.number) },
      color: m.color,
      notation: m.notation,
      from: { r: { $numberInt: String(m.from.r) }, s: { $numberInt: String(m.from.s) } },
      to: { r: { $numberInt: String(m.to.r) }, s: { $numberInt: String(m.to.s) } },
      piece_type: m.piece_type,
      captured: m.captured,
      promotion: m.promotion,
      is_castling: m.is_castling,
      is_en_passant: m.is_en_passant,
      is_check: m.is_check,
      is_checkmate: m.is_checkmate,
      fen_after: m.fen_after,
      played_by: { $oid: m.played_by },
      played_at: { $date: m.played_at }
    })),
    position_counts: game.position_counts,
    hotseat: game.hotseat,
    comment: game.comment,
    created_at: { $date: game.created_at },
    updated_at: { $date: game.updated_at }
  };
}

process.stdout.write(JSON.stringify(games.map(toExtended), null, 2));
