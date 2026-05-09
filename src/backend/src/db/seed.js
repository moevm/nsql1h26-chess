const bcrypt = require('bcryptjs');
const { getDb } = require('./connection');

async function seedRoles() {
  const db = getDb();
  await db.collection('players').updateMany(
    { type: 'player', role: { $exists: false } },
    [{
      $set: {
        role: { $cond: [{ $eq: ['$username', 'admin'] }, 'admin', 'user'] }
      }
    }],
    { bypassDocumentValidation: true }
  );
}

async function seedStats() {
  const db = getDb();
  await db.collection('players').updateMany(
    {
      $or: [
        { 'stats.wins':        { $exists: true, $not: { $type: 'int' } } },
        { 'stats.losses':      { $exists: true, $not: { $type: 'int' } } },
        { 'stats.draws':       { $exists: true, $not: { $type: 'int' } } },
        { 'stats.total_games': { $exists: true, $not: { $type: 'int' } } },
        { 'stats.elo':         { $exists: true, $not: { $type: 'int' } } }
      ]
    },
    [{
      $set: {
        'stats.wins':        { $toInt: { $ifNull: ['$stats.wins', 0] } },
        'stats.losses':      { $toInt: { $ifNull: ['$stats.losses', 0] } },
        'stats.draws':       { $toInt: { $ifNull: ['$stats.draws', 0] } },
        'stats.total_games': { $toInt: { $ifNull: ['$stats.total_games', 0] } },
        'stats.elo':         { $toInt: { $ifNull: ['$stats.elo', 0] } }
      }
    }],
    { bypassDocumentValidation: true }
  );
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

module.exports = { seedRoles, seedStats, seedPasswords };
