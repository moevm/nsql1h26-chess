const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { BSON } = require('mongodb');
const { getDb } = require('./connection');

async function seedIfEmpty() {
  const db = getDb();
  const [playersCount, gamesCount] = await Promise.all([
    db.collection('players').countDocuments({}, { limit: 1 }),
    db.collection('games').countDocuments({}, { limit: 1 })
  ]);
  if (playersCount > 0 || gamesCount > 0) return;

  const file = path.join(__dirname, 'seed-data.json');
  const dump = BSON.EJSON.parse(fs.readFileSync(file, 'utf8'), { relaxed: false });

  if (dump.players && dump.players.length > 0) {
    await db.collection('players').insertMany(dump.players);
    console.log(`Seeded ${dump.players.length} players (incl. bots)`);
  }
  if (dump.games && dump.games.length > 0) {
    await db.collection('games').insertMany(dump.games);
    console.log(`Seeded ${dump.games.length} games`);
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

module.exports = { seedIfEmpty, seedPasswords };
