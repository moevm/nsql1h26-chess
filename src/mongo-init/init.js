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

// админ
const adminId = ObjectId();
db.players.insertOne({
  _id: adminId,
  type: "player",
  username: "admin",
  email: "admin@chess.ru",
  password_hash: "__SEED__",
  status: "active",
  comment: "Администратор системы",
  created_at: new Date(now.getTime() - 30 * 86400000),
  updated_at: new Date(now.getTime() - 30 * 86400000),
  stats: { wins: NumberInt(40), losses: NumberInt(10), draws: NumberInt(5), total_games: NumberInt(55), elo: NumberInt(1800) },
  status_history: [{ changed_at: new Date(now.getTime() - 30 * 86400000), old_status: null, new_status: "active", changed_by: null, reason: "Регистрация" }]
});

// игрок
const player1Id = ObjectId();
db.players.insertOne({
  _id: player1Id,
  type: "player",
  username: "player1",
  email: "player@chess.ru",
  password_hash: "__SEED__",
  status: "active",
  comment: "Тестовый игрок",
  created_at: new Date(now.getTime() - 20 * 86400000),
  updated_at: new Date(now.getTime() - 20 * 86400000),
  stats: { wins: NumberInt(25), losses: NumberInt(18), draws: NumberInt(7), total_games: NumberInt(50), elo: NumberInt(1550) },
  status_history: [{ changed_at: new Date(now.getTime() - 20 * 86400000), old_status: null, new_status: "active", changed_by: null, reason: "Регистрация" }]
});

// бот
const bot1Id = ObjectId();
db.players.insertOne({
  _id: bot1Id,
  type: "bot",
  name: "RandomBot",
  api_url: "http://bots.example.com/random",
  status: "active",
  comment: "Случайные ходы, для тестирования",
  created_at: new Date(now.getTime() - 25 * 86400000),
  updated_at: new Date(now.getTime() - 25 * 86400000),
  stats: { wins: NumberInt(10), losses: NumberInt(80), draws: NumberInt(5), total_games: NumberInt(95), elo: NumberInt(800) },
  status_history: [
    { changed_at: new Date(now.getTime() - 25 * 86400000), old_status: null, new_status: "draft", changed_by: adminId, reason: "Создание бота" },
    { changed_at: new Date(now.getTime() - 24 * 86400000), old_status: "draft", new_status: "active", changed_by: adminId, reason: "Активация" }
  ]
});

// игра между игроком и ботом
db.games.insertOne({
  mode: "bot",
  status: "completed",
  player1_id: player1Id,
  player2_id: bot1Id,
  winner_id: player1Id,
  result: "checkmate",
  comment: "Игра с RandomBot",
  created_at: new Date(now.getTime() - 9 * 86400000),
  updated_at: new Date(now.getTime() - 9 * 86400000),
  moves: [
    { move_number: NumberInt(1), player_id: player1Id, from_sq: "d2", to_sq: "d4", piece: "pawn", captured: null, timestamp: new Date(now.getTime() - 9 * 86400000) },
    { move_number: NumberInt(2), player_id: bot1Id, from_sq: "g8", to_sq: "f6", piece: "knight", captured: null, timestamp: new Date(now.getTime() - 9 * 86400000 + 5000) }
  ],
  status_history: [
    { changed_at: new Date(now.getTime() - 9 * 86400000), old_status: null, new_status: "created", changed_by: player1Id, reason: "Создание партии" },
    { changed_at: new Date(now.getTime() - 9 * 86400000 + 100), old_status: "created", new_status: "in_progress", changed_by: player1Id, reason: "Старт" },
    { changed_at: new Date(now.getTime() - 9 * 86400000 + 100000), old_status: "in_progress", new_status: "completed", changed_by: player1Id, reason: "Мат" }
  ]
});