const ccGameValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'status', 'white_id', 'black_id', 'fen', 'turn',
      'move_number', 'moves', 'created_at', 'updated_at'
    ],
    properties: {
      status: {
        enum: ['active', 'check', 'checkmate', 'stalemate', 'resigned', 'draw', 'abandoned']
      },
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

module.exports = {
  version: 7,
  name: 'cc-drop-threefold',
  async up(db) {
    await db.collection('cc_games').updateMany(
      { status: 'threefold' },
      { $set: { status: 'draw', result: 'draw' } }
    );
    await db.command({ collMod: 'cc_games', validator: ccGameValidator });
  }
};
