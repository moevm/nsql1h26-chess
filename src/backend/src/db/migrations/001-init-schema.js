const playerValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['type', 'status', 'comment', 'created_at', 'updated_at', 'stats', 'status_history'],
    properties: {
      type: { enum: ['player', 'bot'], description: 'Тип участника: player или bot' },
      status: { bsonType: 'string' },
      comment: { bsonType: 'string' },
      created_at: { bsonType: 'date' },
      updated_at: { bsonType: 'date' },
      stats: {
        bsonType: 'object',
        required: ['wins', 'losses', 'draws', 'total_games'],
        properties: {
          wins: { bsonType: 'int' },
          losses: { bsonType: 'int' },
          draws: { bsonType: 'int' },
          total_games: { bsonType: 'int' },
          elo: { bsonType: 'int' }
        }
      },
      status_history: { bsonType: 'array' },
      username: { bsonType: 'string' },
      email: { bsonType: 'string' },
      password_hash: { bsonType: 'string' },
      role: { enum: ['admin', 'user'], description: 'Роль игрока (только для type=player)' },
      name: { bsonType: 'string' },
      api_url: { bsonType: 'string' }
    },
    oneOf: [
      {
        properties: { type: { enum: ['player'] } },
        required: ['username', 'email', 'password_hash']
      },
      {
        properties: { type: { enum: ['bot'] } },
        required: ['name', 'api_url']
      }
    ]
  }
};

const gameValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['mode', 'status', 'player1_id', 'player2_id', 'created_at', 'updated_at', 'moves', 'status_history'],
    properties: {
      mode: { enum: ['hotseat', 'bot'] },
      status: { bsonType: 'string' },
      player1_id: { bsonType: 'objectId' },
      player2_id: { bsonType: 'objectId' },
      winner_id: { bsonType: ['objectId', 'null'] },
      result: { bsonType: ['string', 'null'] },
      comment: { bsonType: 'string' },
      created_at: { bsonType: 'date' },
      updated_at: { bsonType: 'date' },
      moves: { bsonType: 'array' },
      status_history: { bsonType: 'array' }
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
  version: 1,
  name: 'init-schema',
  async up(db) {
    await ensureCollection(db, 'players', playerValidator);
    await ensureCollection(db, 'games', gameValidator);

    await db.collection('players').createIndex({ type: 1, username: 1 }, { sparse: true });
    await db.collection('players').createIndex({ type: 1, email: 1 }, { sparse: true });
    await db.collection('players').createIndex({ type: 1, name: 1 }, { sparse: true });
    await db.collection('players').createIndex({ type: 1, status: 1 });
    await db.collection('games').createIndex({ status: 1, mode: 1 });
    await db.collection('games').createIndex({ player1_id: 1 });
    await db.collection('games').createIndex({ player2_id: 1 });
    await db.collection('games').createIndex({ created_at: -1 });
  }
};
