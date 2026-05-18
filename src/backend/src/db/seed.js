const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { BSON } = require('mongodb');
const { getDb } = require('./connection');

async function seedIfEmpty() {
  const db = getDb();
  const [playersCount, ccGamesCount] = await Promise.all([
    db.collection('players').countDocuments({}, { limit: 1 }),
    db.collection('cc_games').countDocuments({}, { limit: 1 })
  ]);

  const file = path.join(__dirname, 'seed-data.json');
  const dump = BSON.EJSON.parse(fs.readFileSync(file, 'utf8'), { relaxed: false });

  if (playersCount === 0 && dump.players && dump.players.length > 0) {
    await db.collection('players').insertMany(dump.players);
    console.log(`Seeded ${dump.players.length} players (incl. bots)`);
  }

  if (ccGamesCount === 0 && dump.games && dump.games.length > 0) {
    await db.collection('cc_games').insertMany(dump.games);
    console.log(`Seeded ${dump.games.length} circular-chess games`);
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
