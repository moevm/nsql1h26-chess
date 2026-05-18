const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { BSON } = require('mongodb');
const { getDb } = require('./connection');

async function seedIfEmpty() {
  const db = getDb();
  const [playersCount, gamesCount, ccGamesCount] = await Promise.all([
    db.collection('players').countDocuments({}, { limit: 1 }),
    db.collection('games').countDocuments({}, { limit: 1 }),
    db.collection('cc_games').countDocuments({}, { limit: 1 })
  ]);
  // Сидим, если ВСЕ ключевые коллекции пустые. Cc_games считаем отдельно,
  // т.к. её сидинг был добавлен позже — иначе на уже инициализированной БД
  // тестовые партии круговых шахмат не появятся.
  const allEmpty = playersCount === 0 && gamesCount === 0 && ccGamesCount === 0;

  const file = path.join(__dirname, 'seed-data.json');
  const dump = BSON.EJSON.parse(fs.readFileSync(file, 'utf8'), { relaxed: false });

  if (allEmpty) {
    if (dump.players && dump.players.length > 0) {
      await db.collection('players').insertMany(dump.players);
      console.log(`Seeded ${dump.players.length} players (incl. bots)`);
    }
    if (dump.games && dump.games.length > 0) {
      await db.collection('games').insertMany(dump.games);
      console.log(`Seeded ${dump.games.length} games (legacy collection)`);
    }
  }

  // Cc_games сидим, если конкретно эта коллекция пуста — даже на «старой» БД.
  if (ccGamesCount === 0 && dump.cc_games && dump.cc_games.length > 0) {
    await db.collection('cc_games').insertMany(dump.cc_games);
    console.log(`Seeded ${dump.cc_games.length} circular-chess games`);
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

module.exports = { seedIfEmpty, seedPasswords, seedBotApiKeys };
