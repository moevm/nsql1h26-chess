db = db.getSiblingDB('circular_chess');

// Schema validation для players
db.createCollection("players", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["type", "status", "comment", "created_at", "updated_at", "stats", "status_history"],
      properties: {
        type: {
          enum: ["player", "bot"],
          description: "Тип участника: player или bot"
        },
        status: { bsonType: "string" },
        comment: { bsonType: "string" },
        created_at: { bsonType: "date" },
        updated_at: { bsonType: "date" },
        stats: {
          bsonType: "object",
          required: ["wins", "losses", "draws", "total_games"],
          properties: {
            wins: { bsonType: "int" },
            losses: { bsonType: "int" },
            draws: { bsonType: "int" },
            total_games: { bsonType: "int" },
            elo: { bsonType: "int" }
          }
        },
        status_history: { bsonType: "array" },
        username: { bsonType: "string" },
        email: { bsonType: "string" },
        password_hash: { bsonType: "string" },
        name: { bsonType: "string" },
        api_url: { bsonType: "string" }
      },
      oneOf: [
        {
          properties: { type: { enum: ["player"] } },
          required: ["username", "email", "password_hash"]
        },
        {
          properties: { type: { enum: ["bot"] } },
          required: ["name", "api_url"]
        }
      ]
    }
  }
});

// Schema validation для games
db.createCollection("games", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["mode", "status", "player1_id", "player2_id", "created_at", "updated_at", "moves", "status_history"],
      properties: {
        mode: { enum: ["hotseat", "bot"] },
        status: { bsonType: "string" },
        player1_id: { bsonType: "objectId" },
        player2_id: { bsonType: "objectId" },
        winner_id: { bsonType: ["objectId", "null"] },
        result: { bsonType: ["string", "null"] },
        comment: { bsonType: "string" },
        created_at: { bsonType: "date" },
        updated_at: { bsonType: "date" },
        moves: { bsonType: "array" },
        status_history: { bsonType: "array" }
      }
    }
  }
});

db.players.createIndex({ type: 1, username: 1 }, { sparse: true });
db.players.createIndex({ type: 1, email: 1 }, { sparse: true });
db.players.createIndex({ type: 1, name: 1 }, { sparse: true });
db.players.createIndex({ type: 1, status: 1 });
db.games.createIndex({ status: 1, mode: 1 });
db.games.createIndex({ player1_id: 1 });
db.games.createIndex({ player2_id: 1 });
db.games.createIndex({ created_at: -1 });

var now = new Date();

// тестовые даныне 
const player1Id = ObjectId();
db.players.insertOne({
  _id: player1Id,
  type: "player",
  username: "player1",
  email: "player@chess.ru",
  password_hash: "123456",
  status: "active",
  comment: "Первый тестовый игрок",
  created_at: now,
  updated_at: now,
  stats: { wins: NumberInt(25), losses: NumberInt(18), draws: NumberInt(7), total_games: NumberInt(50), elo: NumberInt(0) },
  status_history: [{
    changed_at: now,
    old_status: null,
    new_status: "active",
    changed_by: null,
    reason: "Регистрация"
  }]
});

var bot1Id = ObjectId();
db.players.insertOne({
  _id: bot1Id,
  type: "bot",
  name: "TEST",
  api_url: "https://test",
  status: "active",
  comment: "Тестовый бот",
  created_at: now,
  updated_at: now,
  stats: { wins: NumberInt(120), losses: NumberInt(45), draws: NumberInt(15), total_games: NumberInt(180), elo: NumberInt(0)},
  status_history: [
    { changed_at: new Date(now.getTime() - 86400000), old_status: null, new_status: "draft", changed_by: player1Id, reason: "Создание бота" },
  ]
});