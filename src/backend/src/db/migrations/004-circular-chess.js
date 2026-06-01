const ccGameValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'status', 'white_id', 'black_id', 'fen', 'turn',
      'move_number', 'moves', 'created_at', 'updated_at'
    ],
    properties: {
      status: { enum: ['active', 'check', 'checkmate', 'stalemate', 'threefold', 'resigned', 'draw', 'abandoned'] },
      white_id: { bsonType: 'objectId' },
      black_id: { bsonType: 'objectId' },
      winner_id: { bsonType: ['objectId', 'null'] },
      result: { bsonType: ['string', 'null'] },
      fen: { bsonType: 'string' },
      turn: { enum: ['w', 'b'] },
      move_number: { bsonType: 'int' },
      moves: { bsonType: 'array' },
      comment: { bsonType: 'string' },
      created_at: { bsonType: 'date' },
      updated_at: { bsonType: 'date' }
    }
  }
};

async function ensureCollection(db, name, validator) {
  const existing = await db.listCollections({ name }).toArray();
  if (existing.length === 0) {
    await db.createCollection(name, { validator });
  } else {
    await db.command({ collMod: name, validator });
  }
}

module.exports = {
  version: 4,
  name: 'circular-chess-collections',
  async up(db) {
    await ensureCollection(db, 'cc_games', ccGameValidator);
    await db.collection('cc_games').createIndex({ status: 1 });
    await db.collection('cc_games').createIndex({ white_id: 1 });
    await db.collection('cc_games').createIndex({ black_id: 1 });
    await db.collection('cc_games').createIndex({ created_at: -1 });
    await db.collection('cc_games').createIndex({ updated_at: -1 });
  }
};
