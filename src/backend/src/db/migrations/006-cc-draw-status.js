// Расширяем валидатор cc_games: добавляем статус 'draw' (ничья по соглашению).
// Миграция 004 уже применена на существующих БД, поэтому правим валидатор отдельно.
const ccGameValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'status', 'white_id', 'black_id', 'fen', 'turn',
      'move_number', 'moves', 'created_at', 'updated_at'
    ],
    properties: {
      status: {
        enum: ['active', 'check', 'checkmate', 'stalemate', 'threefold', 'resigned', 'draw', 'abandoned']
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
  version: 6,
  name: 'cc-draw-status',
  async up(db) {
    await db.command({ collMod: 'cc_games', validator: ccGameValidator });
  }
};
