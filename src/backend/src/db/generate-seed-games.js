// нужен для генерации самосогласованного seed-data.json, чтобы был качественный пример данных
const fs = require('fs');
const path = require('path');
const cc = require('../game/circular-chess');
const { BASE_ELO, updateRatings } = require('../utils/elo');

const oid = (h) => ({ $oid: h });
const date = (iso) => ({ $date: iso });
const int = (n) => ({ $numberInt: String(n) });

function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

const COUNTED = new Set(['checkmate', 'stalemate', 'resigned', 'draw']);

function playGame(seed, { maxPlies, stopStatuses = null, captureBias = 0 }) {
  const engine = new cc.Engine();
  const rng = makeRng(seed);
  const moves = [];

  while (moves.length < maxPlies) {
    const status = engine.getStatus();
    if (status === 'checkmate' || status === 'stalemate') break;
    if (stopStatuses && stopStatuses.has(status)) break;

    const legal = engine.getLegalMoves();
    if (!legal.length) break;

    const turn = engine.getTurn();
    const before = engine.getMoveNumber();
    let pool = legal;
    if (captureBias > 0) {
      const caps = legal.filter(m => m.captured);
      if (caps.length && rng() < captureBias) pool = caps;
    }
    const chosen = pool[Math.floor(rng() * pool.length)];
    const played = engine.move({ from: chosen.from, to: chosen.to, promotion: chosen.promotion });
    const afterStatus = engine.getStatus();

    moves.push({
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
      fen_after: engine.toFEN()
    });
  }

  return {
    fen: engine.toFEN(),
    turn: engine.getTurn(),
    moveNumber: engine.getMoveNumber(),
    positionCounts: engine.getPositionCounts(),
    moves,
    finalStatus: engine.getStatus()
  };
}

function collectTerminalSeeds({ needCheckmate, needStalemate, maxPlies, seedLimit, captureBias }) {
  const mates = [];
  const stalemates = [];
  const targetMate = needCheckmate + 3;
  const targetStale = needStalemate + 2;
  for (let seed = 1; seed <= seedLimit; seed++) {
    const g = playGame(seed, { maxPlies, captureBias });
    if (g.finalStatus === 'checkmate') mates.push({ seed, len: g.moves.length });
    else if (g.finalStatus === 'stalemate') stalemates.push({ seed, len: g.moves.length });
    if (mates.length >= targetMate && stalemates.length >= targetStale) break;
  }
  mates.sort((a, b) => a.len - b.len);
  stalemates.sort((a, b) => a.len - b.len);
  if (mates.length < needCheckmate) throw new Error(`Найдено матов: ${mates.length}, нужно ${needCheckmate}`);
  if (stalemates.length < needStalemate) throw new Error(`Найдено патов: ${stalemates.length}, нужно ${needStalemate}`);
  return {
    checkmate: mates.slice(0, needCheckmate).map(m => m.seed),
    stalemate: stalemates.slice(0, needStalemate).map(m => m.seed)
  };
}

function findCheckSeed(startSeed, used) {
  for (let seed = startSeed; seed < startSeed + 100000; seed++) {
    if (used.has(seed)) continue;
    const g = playGame(seed, { maxPlies: 80, stopStatuses: new Set(['check']) });
    if (g.finalStatus === 'check' && g.moves.length >= 4) {
      used.add(seed);
      return g;
    }
  }
  throw new Error('Не нашёл партию с шахом');
}

function findOngoing(plies, startSeed, used) {
  for (let seed = startSeed; seed < startSeed + 100000; seed++) {
    if (used.has(seed)) continue;
    const g = playGame(seed, { maxPlies: plies });
    if (g.finalStatus !== 'checkmate' && g.finalStatus !== 'stalemate' && g.moves.length >= Math.min(4, plies)) {
      used.add(seed);
      return g;
    }
  }
  throw new Error('Не нашёл незавершённую партию');
}


const ADMIN = '000000000000000000000001';

const reg = (at, status) => ({ at, old: null, new: status, by: null, reason: 'Регистрация' });
const botReg = (at) => ({ at, old: null, new: 'draft', by: ADMIN, reason: 'Создание бота' });
const stepH = (at, from, to, reason) => ({ at, old: from, new: to, by: ADMIN, reason });

const PLAYERS = [
  { _id: '000000000000000000000001', username: 'admin', email: 'admin@chess.ru', role: 'admin', status: 'active',
    created: '2026-04-10T12:00:00Z', comment: 'Администратор системы',
    history: [reg('2026-04-10T12:00:00Z', 'active')] },
  { _id: '000000000000000000000002', username: 'player1', email: 'player@chess.ru', role: 'user', status: 'active',
    created: '2026-04-12T12:00:00Z', comment: 'Тестовый игрок',
    history: [reg('2026-04-12T12:00:00Z', 'active')] },
  { _id: '000000000000000000000003', username: 'ivanov', email: 'ivanov@chess.ru', role: 'user', status: 'active',
    created: '2026-04-14T12:00:00Z', comment: 'Иванов Алексей, опытный игрок',
    history: [reg('2026-04-14T12:00:00Z', 'active')] },
  { _id: '000000000000000000000004', username: 'petrova', email: 'petrova@chess.ru', role: 'user', status: 'active',
    created: '2026-04-16T12:00:00Z', comment: 'Петрова Мария',
    history: [reg('2026-04-16T12:00:00Z', 'active')] },
  { _id: '000000000000000000000005', username: 'sidorov', email: 'sidorov@chess.ru', role: 'user', status: 'active',
    created: '2026-04-18T12:00:00Z', comment: 'Сидоров Пётр',
    history: [reg('2026-04-18T12:00:00Z', 'active')] },
  { _id: '000000000000000000000006', username: 'kuznetsov', email: 'kuznetsov@chess.ru', role: 'user', status: 'banned',
    created: '2026-04-20T12:00:00Z', updated: '2026-05-18T12:00:00Z', comment: 'Заблокирован за нарушение правил',
    history: [reg('2026-04-20T12:00:00Z', 'active'), stepH('2026-05-18T12:00:00Z', 'active', 'banned', 'Нарушение правил')] },
  { _id: '000000000000000000000007', username: 'smirnova', email: 'smirnova@chess.ru', role: 'user', status: 'active',
    created: '2026-04-08T12:00:00Z', comment: 'Смирнова Анна, мастер спорта',
    history: [reg('2026-04-08T12:00:00Z', 'active')] },
  { _id: '000000000000000000000008', username: 'fedorov', email: 'fedorov@chess.ru', role: 'user', status: 'active',
    created: '2026-04-22T12:00:00Z', comment: 'Фёдоров Дмитрий',
    history: [reg('2026-04-22T12:00:00Z', 'active')] },
  { _id: '000000000000000000000009', username: 'volkov', email: 'volkov@chess.ru', role: 'user', status: 'deleted',
    created: '2026-04-24T12:00:00Z', updated: '2026-05-20T12:00:00Z', comment: 'Аккаунт удалён по запросу',
    history: [reg('2026-04-24T12:00:00Z', 'active'), stepH('2026-05-20T12:00:00Z', 'active', 'deleted', 'Удаление по запросу пользователя')] },
  { _id: '00000000000000000000000a', username: 'novikova', email: 'novikova@chess.ru', role: 'user', status: 'active',
    created: '2026-04-26T12:00:00Z', comment: 'Новикова Ольга',
    history: [reg('2026-04-26T12:00:00Z', 'active')] }
];

const BOTS = [
  { _id: '000000000000000000000101', name: 'RandomBot', status: 'active', created: '2026-04-15T12:00:00Z',
    comment: 'Случайные ходы, для тестирования',
    history: [botReg('2026-04-15T12:00:00Z'), stepH('2026-04-16T12:00:00Z', 'draft', 'active', 'Активация')] },
  { _id: '000000000000000000000102', name: 'GreedyBot', status: 'active', created: '2026-04-17T12:00:00Z',
    comment: 'Жадный: бьёт при первой возможности',
    history: [botReg('2026-04-17T12:00:00Z'), stepH('2026-04-18T12:00:00Z', 'draft', 'active', 'Активация')] },
  { _id: '000000000000000000000103', name: 'DefenderBot', status: 'testing', created: '2026-04-19T12:00:00Z',
    comment: 'Оборонительная стратегия, на тестировании',
    history: [botReg('2026-04-19T12:00:00Z'), stepH('2026-04-21T12:00:00Z', 'draft', 'testing', 'Отправлен на тестирование')] },
  { _id: '000000000000000000000104', name: 'AggressorBot', status: 'testing', created: '2026-04-23T12:00:00Z',
    comment: 'Агрессивная атака, на тестировании',
    history: [botReg('2026-04-23T12:00:00Z'), stepH('2026-04-25T12:00:00Z', 'draft', 'testing', 'Отправлен на тестирование')] },
  { _id: '000000000000000000000105', name: 'RookieBot', status: 'draft', created: '2026-05-02T12:00:00Z',
    comment: 'Новый бот, ещё не активирован',
    history: [botReg('2026-05-02T12:00:00Z')] },
  { _id: '000000000000000000000106', name: 'ExperimentalBot', status: 'draft', created: '2026-05-04T12:00:00Z',
    comment: 'Экспериментальный алгоритм, черновик',
    history: [botReg('2026-05-04T12:00:00Z')] },
  { _id: '000000000000000000000107', name: 'LegacyBot', status: 'disabled', created: '2026-04-05T12:00:00Z',
    comment: 'Устаревший бот, отключён',
    history: [botReg('2026-04-05T12:00:00Z'), stepH('2026-04-06T12:00:00Z', 'draft', 'active', 'Активация'),
      stepH('2026-05-19T12:00:00Z', 'active', 'disabled', 'Выведен из эксплуатации')] },
  { _id: '000000000000000000000108', name: 'MirrorBot', status: 'active', created: '2026-04-27T12:00:00Z',
    comment: 'Зеркалит ходы соперника',
    history: [botReg('2026-04-27T12:00:00Z'), stepH('2026-04-28T12:00:00Z', 'draft', 'active', 'Активация')] }
];

const ID = {};
[...PLAYERS, ...BOTS].forEach(p => { ID[p.username || p.name] = p._id; });
const pid = (alias) => {
  if (!ID[alias]) throw new Error('Неизвестный участник: ' + alias);
  return ID[alias];
};
const BOT_ALIASES = new Set(BOTS.map(b => b.name));
const isBot = (alias) => BOT_ALIASES.has(alias);

const SPECS = [
  { status: 'checkmate', result: 'checkmate', sim: 'checkmate', white: 'smirnova', black: 'RandomBot',
    comment: 'Победа матом над ботом', created: '2026-05-01T10:00:00Z', dur: 95 },
  { status: 'resigned', result: 'resignation', sim: 'ongoing', plies: 24, winner: 'white', white: 'ivanov', black: 'GreedyBot',
    comment: 'Бот сдался в худшей позиции', created: '2026-05-02T11:00:00Z', dur: 40 },
  { status: 'draw', result: 'draw', sim: 'ongoing', plies: 34, white: 'petrova', black: 'sidorov',
    comment: 'Ничья по соглашению', created: '2026-05-03T16:00:00Z', dur: 55 },
  { status: 'checkmate', result: 'checkmate', sim: 'checkmate', white: 'kuznetsov', black: 'fedorov',
    comment: 'Мат в миттельшпиле', created: '2026-05-04T11:00:00Z', dur: 80 },
  { status: 'stalemate', result: 'stalemate', sim: 'stalemate', white: 'smirnova', black: 'ivanov',
    comment: 'Партия завершилась патом', created: '2026-05-05T14:00:00Z', dur: 120 },
  { status: 'resigned', result: 'resignation', sim: 'ongoing', plies: 18, winner: 'black', white: 'player1', black: 'DefenderBot',
    comment: 'Игрок сдался боту', created: '2026-05-06T13:00:00Z', dur: 30 },
  { status: 'checkmate', result: 'checkmate', sim: 'checkmate', white: 'GreedyBot', black: 'RandomBot',
    comment: 'Матч ботов: победа матом', created: '2026-05-07T09:00:00Z', dur: 70 },
  { status: 'draw', result: 'draw', sim: 'ongoing', plies: 40, white: 'novikova', black: 'admin',
    comment: 'Ничья после долгой борьбы', created: '2026-05-08T17:00:00Z', dur: 65 },
  { status: 'checkmate', result: 'checkmate', sim: 'checkmate', white: 'LegacyBot', black: 'volkov',
    comment: 'Бот поставил мат', created: '2026-05-09T10:00:00Z', dur: 75 },
  { status: 'resigned', result: 'resignation', sim: 'ongoing', plies: 26, winner: 'white', white: 'AggressorBot', black: 'MirrorBot',
    comment: 'MirrorBot сдался', created: '2026-05-10T12:00:00Z', dur: 35 },
  { status: 'abandoned', result: 'abandoned', sim: 'ongoing', plies: 8, white: 'player1', black: 'admin',
    comment: 'Партия прервана участником', created: '2026-05-11T18:00:00Z', dur: 10 },
  { status: 'check', result: null, sim: 'check', white: 'ivanov', black: 'petrova',
    comment: 'Чёрному королю объявлен шах', created: '2026-05-12T15:00:00Z', dur: 25 },
  { status: 'active', result: null, sim: 'ongoing', plies: 16, white: 'fedorov', black: 'sidorov',
    comment: 'Партия в процессе', created: '2026-05-13T19:00:00Z', dur: 20 },
  { status: 'active', result: null, sim: 'ongoing', plies: 9, white: 'novikova', black: 'RandomBot',
    comment: 'Игрок против бота — ход бота', created: '2026-05-14T12:00:00Z', dur: 12 },
  { status: 'check', result: null, sim: 'check', white: 'smirnova', black: 'GreedyBot',
    comment: 'Шах в дебюте', created: '2026-05-15T14:00:00Z', dur: 18 },
  { status: 'active', result: null, sim: 'ongoing', plies: 12, white: 'player1', black: 'ivanov',
    comment: 'Активная партия, миттельшпиль', created: '2026-05-16T10:00:00Z', dur: 22 }
];

function buildGameDoc(spec, sim) {
  let winnerAlias = null;
  if (spec.status === 'checkmate') {
    const last = sim.moves[sim.moves.length - 1];
    winnerAlias = last && last.color === 'w' ? spec.white : spec.black;
  } else if (spec.status === 'resigned') {
    winnerAlias = spec.winner === 'white' ? spec.white : spec.black;
  }
  const winnerId = winnerAlias ? pid(winnerAlias) : null;

  const t0 = new Date(spec.created).getTime();
  const t1 = t0 + spec.dur * 60 * 1000;
  const updated = new Date(t1).toISOString();
  const span = sim.moves.length > 0 ? (t1 - t0) / (sim.moves.length + 1) : 0;

  const moves = sim.moves.map((m, i) => ({
    number: int(i + 1),
    color: m.color,
    notation: m.notation,
    from: { r: int(m.from.r), s: int(m.from.s) },
    to: { r: int(m.to.r), s: int(m.to.s) },
    piece_type: m.piece_type,
    captured: m.captured,
    promotion: m.promotion,
    is_castling: m.is_castling,
    is_en_passant: m.is_en_passant,
    is_check: m.is_check,
    is_checkmate: m.is_checkmate,
    fen_after: m.fen_after,
    played_by: oid(pid(m.color === 'w' ? spec.white : spec.black)),
    played_at: date(new Date(t0 + span * (i + 1)).toISOString())
  }));

  return {
    doc: {
      status: spec.status,
      white_id: oid(pid(spec.white)),
      black_id: oid(pid(spec.black)),
      winner_id: winnerId ? oid(winnerId) : null,
      result: spec.result,
      fen: sim.fen,
      turn: sim.turn,
      move_number: int(moves.length),
      moves,
      position_counts: sim.positionCounts,
      hotseat: !isBot(spec.white) && !isBot(spec.black),
      comment: spec.comment,
      created_at: date(spec.created),
      updated_at: date(updated)
    },
    flat: {
      status: spec.status,
      white: pid(spec.white),
      black: pid(spec.black),
      winner: winnerId,
      created: spec.created
    }
  };
}

function computeStats(flatGames) {
  const stats = {};
  [...PLAYERS, ...BOTS].forEach(p => {
    stats[p._id] = { wins: 0, losses: 0, draws: 0, total: 0, elo: BASE_ELO };
  });

  const counted = flatGames
    .filter(g => COUNTED.has(g.status))
    .sort((a, b) => new Date(a.created) - new Date(b.created));

  for (const g of counted) {
    const w = g.white, b = g.black;
    const we = stats[w].elo, be = stats[b].elo;
    let whiteScore;
    if (g.winner) {
      const whiteWon = g.winner === w;
      whiteScore = whiteWon ? 1 : 0;
      if (whiteWon) { stats[w].wins++; stats[b].losses++; }
      else { stats[b].wins++; stats[w].losses++; }
    } else {
      whiteScore = 0.5;
      stats[w].draws++; stats[b].draws++;
    }
    stats[w].total++; stats[b].total++;
    const { whiteNew, blackNew } = updateRatings(we, be, whiteScore);
    stats[w].elo = whiteNew; stats[b].elo = blackNew;
  }
  return stats;
}

function statsBlock(s) {
  return {
    wins: int(s.wins), losses: int(s.losses), draws: int(s.draws),
    total_games: int(s.total), elo: int(s.elo)
  };
}

function historyBlock(history) {
  return history.map(h => ({
    changed_at: date(h.at),
    old_status: h.old,
    new_status: h.new,
    changed_by: h.by ? oid(h.by) : null,
    reason: h.reason
  }));
}

const TERM_MAXPLIES = 260;
const TERM_BIAS = 0.8;

function main() {
  const used = new Set();

  process.stderr.write('Поиск партий с матом/патом...\n');
  const terminal = collectTerminalSeeds({
    needCheckmate: 4, needStalemate: 1, maxPlies: TERM_MAXPLIES, seedLimit: 3000, captureBias: TERM_BIAS
  });
  const matePool = terminal.checkmate.slice();
  const stalematePool = terminal.stalemate.slice();
  terminal.checkmate.forEach(s => used.add(s));
  terminal.stalemate.forEach(s => used.add(s));

  let checkStart = 50000;
  let ongoingStart = 70000;

  const games = [];
  const flats = [];
  for (const spec of SPECS) {
    let sim;
    if (spec.sim === 'checkmate') {
      sim = playGame(matePool.shift(), { maxPlies: TERM_MAXPLIES, captureBias: TERM_BIAS });
    } else if (spec.sim === 'stalemate') {
      sim = playGame(stalematePool.shift(), { maxPlies: TERM_MAXPLIES, captureBias: TERM_BIAS });
    } else if (spec.sim === 'check') {
      sim = findCheckSeed(checkStart, used); checkStart += 1;
    } else {
      sim = findOngoing(spec.plies, ongoingStart, used); ongoingStart += 1;
    }
    const built = buildGameDoc(spec, sim);
    games.push(built.doc);
    flats.push(built.flat);
  }

  const stats = computeStats(flats);

  const players = PLAYERS.map(p => ({
    _id: oid(p._id),
    type: 'player',
    username: p.username,
    email: p.email,
    password_hash: '__SEED__',
    role: p.role,
    status: p.status,
    comment: p.comment,
    created_at: date(p.created),
    updated_at: date(p.updated || p.created),
    stats: statsBlock(stats[p._id]),
    status_history: historyBlock(p.history)
  }));

  const bots = BOTS.map(b => ({
    _id: oid(b._id),
    type: 'bot',
    name: b.name,
    status: b.status,
    comment: b.comment,
    created_at: date(b.created),
    updated_at: date(b.updated || b.created),
    stats: statsBlock(stats[b._id]),
    status_history: historyBlock(b.history)
  }));

  const dump = { players: [...players, ...bots], games };

  const outFile = path.join(__dirname, 'seed-data.json');
  fs.writeFileSync(outFile, JSON.stringify(dump, null, 2));

  const byStatus = {};
  flats.forEach(g => { byStatus[g.status] = (byStatus[g.status] || 0) + 1; });
  process.stderr.write(`\nГотово: ${players.length} игроков, ${bots.length} ботов, ${games.length} партий\n`);
  process.stderr.write(`Партии по статусам: ${JSON.stringify(byStatus)}\n`);
  process.stderr.write('Статистика участников (W/L/D/total, elo):\n');
  [...PLAYERS, ...BOTS].forEach(p => {
    const s = stats[p._id];
    process.stderr.write(`  ${(p.username || p.name).padEnd(16)} ${s.wins}/${s.losses}/${s.draws}/${s.total}  elo ${s.elo}\n`);
  });
}

main();
