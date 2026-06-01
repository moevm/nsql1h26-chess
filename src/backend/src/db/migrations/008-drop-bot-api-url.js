const playerValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['type', 'status', 'comment', 'created_at', 'updated_at', 'stats', 'status_history'],
    properties: {
      type: { enum: ['player', 'bot'] },
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
      role: { enum: ['admin', 'user'] },
      name: { bsonType: 'string' },
      api_key: { bsonType: 'string' }
    },
    oneOf: [
      {
        properties: { type: { enum: ['player'] } },
        required: ['username', 'email', 'password_hash']
      },
      {
        properties: { type: { enum: ['bot'] } },
        required: ['name']
      }
    ]
  }
};

module.exports = {
  version: 8,
  name: 'drop-bot-api-url',
  async up(db) {
    await db.command({ collMod: 'players', validator: playerValidator });
    await db.collection('players').updateMany(
      { type: 'bot', api_url: { $exists: true } },
      { $unset: { api_url: '' } },
      { bypassDocumentValidation: true }
    );
  }
};
