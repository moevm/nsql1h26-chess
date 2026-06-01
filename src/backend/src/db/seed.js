const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { BSON, Int32 } = require('mongodb');
const { getDb } = require('./connection');
const { BASE_ELO, updateRatings } = require('../utils/elo');

const COUNTED_STATUSES = new Set(['checkmate', 'stalemate', 'resigned', 'draw']);

async function recomputeStatsFromGames() {
  const db = getDb();
  const players = await db.collection('players').find({}).project({ _id: 1 }).toArray();
  const stats = {};
  for (const p of players) {
    stats[p._id.toString()] = { wins: 0, losses: 0, draws: 0, total_games: 0, elo: BASE_ELO };
  }

  const games = await db.collection('cc_games').find({
    status: { $in: Array.from(COUNTED_STATUSES) }
  }).sort({ created_at: 1, _id: 1 }).toArray();

  for (const g of games) {
    const w = g.white_id.toString();
    const b = g.black_id.toString();
    if (!stats[w] || !stats[b]) continue;
    const whiteElo = stats[w].elo;
    const blackElo = stats[b].elo;
    let whiteScore;
    if (g.winner_id) {
      const winnerIsWhite = g.winner_id.toString() === w;
      whiteScore = winnerIsWhite ? 1 : 0;
      if (winnerIsWhite) { stats[w].wins++; stats[b].losses++; }
      else { stats[b].wins++; stats[w].losses++; }
    } else {
      whiteScore = 0.5;
      stats[w].draws++;
      stats[b].draws++;
    }
    stats[w].total_games++;
    stats[b].total_games++;
    const { whiteNew, blackNew } = updateRatings(whiteElo, blackElo, whiteScore);
    stats[w].elo = whiteNew;
    stats[b].elo = blackNew;
  }

  const now = new Date();
  for (const p of players) {
    const s = stats[p._id.toString()];
    await db.collection('players').updateOne(
      { _id: p._id },
      {
        $set: {
          'stats.wins': new Int32(s.wins),
          'stats.losses': new Int32(s.losses),
          'stats.draws': new Int32(s.draws),
          'stats.total_games': new Int32(s.total_games),
          'stats.elo': new Int32(s.elo),
          updated_at: now
        }
      },
      { bypassDocumentValidation: true }
    );
  }
  console.log(`Recomputed stats for ${players.length} participants from ${games.length} games`);
}

async function seedIfEmpty() {
  const db = getDb();
  const [playersCount, ccGamesCount] = await Promise.all([
    db.collection('players').countDocuments({}, { limit: 1 }),
    db.collection('cc_games').countDocuments({}, { limit: 1 })
  ]);

  const file = path.join(__dirname, 'seed-data.json');
  const dump = BSON.EJSON.parse(fs.readFileSync(file, 'utf8'), { relaxed: false });

  let seededPlayers = false;
  let seededGames = false;

  if (playersCount === 0 && dump.players && dump.players.length > 0) {
    await db.collection('players').insertMany(dump.players);
    console.log(`Seeded ${dump.players.length} players (incl. bots)`);
    seededPlayers = true;
  }

  if (ccGamesCount === 0 && dump.games && dump.games.length > 0) {
    await db.collection('cc_games').insertMany(dump.games);
    console.log(`Seeded ${dump.games.length} circular-chess games`);
    seededGames = true;
  }

  if (seededPlayers || seededGames) {
    await recomputeStatsFromGames();
  }
}

async function seedPasswords() {
  const db = getDb();
  const players = await db.collection('players').find({
    type: 'player',
    password_hash: '__SEED__'
  }).toArray();

  for (const p of players) {
    const password = p.username === 'admin' ? 'admin123' : 'player123';
    const hash = await bcrypt.hash(password, 10);
    await db.collection('players').updateOne(
      { _id: p._id },
      { $set: { password_hash: hash, updated_at: new Date() } },
      { bypassDocumentValidation: true }
    );
    console.log(`Seeded password for ${p.username}`);
  }
}

async function seedBotApiKeys() {
  const db = getDb();
  const bots = await db.collection('players').find({
    type: 'bot',
    $or: [{ api_key: { $exists: false } }, { api_key: null }]
  }).toArray();

  for (const bot of bots) {
    const key = crypto.randomBytes(16).toString('hex');
    await db.collection('players').updateOne(
      { _id: bot._id },
      { $set: { api_key: key, updated_at: new Date() } },
      { bypassDocumentValidation: true }
    );
    console.log(`API key for bot "${bot.name}": ${key}`);
  }
}

module.exports = { seedIfEmpty, seedPasswords, seedBotApiKeys, recomputeStatsFromGames };