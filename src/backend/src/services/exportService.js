const { ObjectId } = require('mongodb');
const { playersCol } = require('../models/playerModel');
const { gamesCol } = require('../models/gameModel');
const { getDb } = require('../db/connection');
const ApiError = require('../utils/ApiError');

async function exportAll() {
  const [players, bots, games] = await Promise.all([
    playersCol().find({ type: 'player' }).project({ password_hash: 0 }).toArray(),
    playersCol().find({ type: 'bot' }).toArray(),
    gamesCol().find({}).toArray()
  ]);
  return { exported_at: new Date().toISOString(), players, bots, games };
}

async function importAll({ players, bots, games, strategy = 'skip' }) {
  if (!['skip', 'overwrite', 'add'].includes(strategy)) {
    throw new ApiError(400, 'Недопустимая стратегия');
  }
  const db = getDb();
  const results = { players: 0, bots: 0, games: 0, errors: [] };

  const importItems = async (items, collection, type) => {
    if (!items || !Array.isArray(items)) return;
    for (const item of items) {
      try {
        const doc = { ...item };
        if (doc._id) doc._id = new ObjectId(doc._id.toString());
        if (doc.player1_id) doc.player1_id = new ObjectId(doc.player1_id.toString());
        if (doc.player2_id) doc.player2_id = new ObjectId(doc.player2_id.toString());
        if (doc.winner_id) doc.winner_id = new ObjectId(doc.winner_id.toString());
        if (doc.created_at) doc.created_at = new Date(doc.created_at);
        if (doc.updated_at) doc.updated_at = new Date(doc.updated_at);
        if (type) doc.type = type;

        const opts = { bypassDocumentValidation: true };
        if (strategy === 'add') {
          delete doc._id;
          await db.collection(collection).insertOne(doc, opts);
        } else if (strategy === 'overwrite' && doc._id) {
          await db.collection(collection).replaceOne(
            { _id: doc._id }, doc,
            { upsert: true, bypassDocumentValidation: true }
          );
        } else if (strategy === 'skip') {
          if (doc._id) {
            const exists = await db.collection(collection).findOne({ _id: doc._id });
            if (!exists) await db.collection(collection).insertOne(doc, opts);
          } else {
            await db.collection(collection).insertOne(doc, opts);
          }
        }
        if (type === 'player') results.players++;
        else if (type === 'bot') results.bots++;
        else results.games++;
      } catch (e) {
        results.errors.push(`${type || 'game'}: ${e.message}`);
      }
    }
  };

  await importItems(players, 'players', 'player');
  await importItems(bots, 'players', 'bot');
  await importItems(games, 'games', null);

  return { message: 'Импорт завершён', results };
}

module.exports = { exportAll, importAll };
