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

// Игроки==========================================================

// Админ
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

const player2Id = ObjectId();
db.players.insertOne({
  _id: player2Id,
  type: "player",
  username: "ivanov",
  email: "ivanov@chess.ru",
  password_hash: "__SEED__",
  status: "active",
  comment: "Иванов Алексей, опытный игрок",
  created_at: new Date(now.getTime() - 15 * 86400000),
  updated_at: new Date(now.getTime() - 15 * 86400000),
  stats: { wins: NumberInt(30), losses: NumberInt(12), draws: NumberInt(8), total_games: NumberInt(50), elo: NumberInt(1650) },
  status_history: [{ changed_at: new Date(now.getTime() - 15 * 86400000), old_status: null, new_status: "active", changed_by: null, reason: "Регистрация" }]
});

const player3Id = ObjectId();
db.players.insertOne({
  _id: player3Id,
  type: "player",
  username: "petrova",
  email: "petrova@chess.ru",
  password_hash: "__SEED__",
  status: "active",
  comment: "Петрова Мария",
  created_at: new Date(now.getTime() - 12 * 86400000),
  updated_at: new Date(now.getTime() - 12 * 86400000),
  stats: { wins: NumberInt(15), losses: NumberInt(20), draws: NumberInt(5), total_games: NumberInt(40), elo: NumberInt(1400) },
  status_history: [{ changed_at: new Date(now.getTime() - 12 * 86400000), old_status: null, new_status: "active", changed_by: null, reason: "Регистрация" }]
});

const player4Id = ObjectId();
db.players.insertOne({
  _id: player4Id,
  type: "player",
  username: "sidorov",
  email: "sidorov@chess.ru",
  password_hash: "__SEED__",
  status: "active",
  comment: "Сидоров Николай, новичок",
  created_at: new Date(now.getTime() - 8 * 86400000),
  updated_at: new Date(now.getTime() - 8 * 86400000),
  stats: { wins: NumberInt(5), losses: NumberInt(8), draws: NumberInt(2), total_games: NumberInt(15), elo: NumberInt(1200) },
  status_history: [{ changed_at: new Date(now.getTime() - 8 * 86400000), old_status: null, new_status: "active", changed_by: null, reason: "Регистрация" }]
});

const player5Id = ObjectId();
db.players.insertOne({
  _id: player5Id,
  type: "player",
  username: "kuznetsov",
  email: "kuznetsov@chess.ru",
  password_hash: "__SEED__",
  status: "banned",
  comment: "Нарушение правил",
  created_at: new Date(now.getTime() - 25 * 86400000),
  updated_at: new Date(now.getTime() - 3 * 86400000),
  stats: { wins: NumberInt(10), losses: NumberInt(5), draws: NumberInt(1), total_games: NumberInt(16), elo: NumberInt(1300) },
  status_history: [
    { changed_at: new Date(now.getTime() - 25 * 86400000), old_status: null, new_status: "active", changed_by: null, reason: "Регистрация" },
    { changed_at: new Date(now.getTime() - 3 * 86400000), old_status: "active", new_status: "banned", changed_by: adminId, reason: "Нарушение правил сообщества" }
  ]
});

const player6Id = ObjectId();
db.players.insertOne({
  _id: player6Id,
  type: "player",
  username: "smirnova",
  email: "smirnova@chess.ru",
  password_hash: "__SEED__",
  status: "active",
  comment: "Смирнова Анна, мастер спорта",
  created_at: new Date(now.getTime() - 40 * 86400000),
  updated_at: new Date(now.getTime() - 40 * 86400000),
  stats: { wins: NumberInt(60), losses: NumberInt(15), draws: NumberInt(12), total_games: NumberInt(87), elo: NumberInt(2000) },
  status_history: [{ changed_at: new Date(now.getTime() - 40 * 86400000), old_status: null, new_status: "active", changed_by: null, reason: "Регистрация" }]
});

const player7Id = ObjectId();
db.players.insertOne({
  _id: player7Id,
  type: "player",
  username: "fedorov",
  email: "fedorov@chess.ru",
  password_hash: "__SEED__",
  status: "active",
  comment: "Фёдоров Дмитрий",
  created_at: new Date(now.getTime() - 5 * 86400000),
  updated_at: new Date(now.getTime() - 5 * 86400000),
  stats: { wins: NumberInt(3), losses: NumberInt(2), draws: NumberInt(0), total_games: NumberInt(5), elo: NumberInt(1100) },
  status_history: [{ changed_at: new Date(now.getTime() - 5 * 86400000), old_status: null, new_status: "active", changed_by: null, reason: "Регистрация" }]
});

// Боты==========================================================

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

const bot2Id = ObjectId();
db.players.insertOne({
  _id: bot2Id,
  type: "bot",
  name: "GreedyBot",
  api_url: "http://bots.example.com/greedy",
  status: "active",
  comment: "Жадная стратегия — берёт любую фигуру при возможности",
  created_at: new Date(now.getTime() - 20 * 86400000),
  updated_at: new Date(now.getTime() - 20 * 86400000),
  stats: { wins: NumberInt(45), losses: NumberInt(40), draws: NumberInt(10), total_games: NumberInt(95), elo: NumberInt(1100) },
  status_history: [
    { changed_at: new Date(now.getTime() - 20 * 86400000), old_status: null, new_status: "draft", changed_by: adminId, reason: "Создание бота" },
    { changed_at: new Date(now.getTime() - 19 * 86400000), old_status: "draft", new_status: "testing", changed_by: adminId, reason: "Начало тестирования" },
    { changed_at: new Date(now.getTime() - 18 * 86400000), old_status: "testing", new_status: "active", changed_by: adminId, reason: "Тестирование пройдено" }
  ]
});

const bot3Id = ObjectId();
db.players.insertOne({
  _id: bot3Id,
  type: "bot",
  name: "MinimaxBot",
  api_url: "http://bots.example.com/minimax",
  status: "active",
  comment: "Алгоритм минимакс, глубина 4",
  created_at: new Date(now.getTime() - 18 * 86400000),
  updated_at: new Date(now.getTime() - 18 * 86400000),
  stats: { wins: NumberInt(70), losses: NumberInt(20), draws: NumberInt(15), total_games: NumberInt(105), elo: NumberInt(1600) },
  status_history: [
    { changed_at: new Date(now.getTime() - 18 * 86400000), old_status: null, new_status: "draft", changed_by: adminId, reason: "Создание бота" },
    { changed_at: new Date(now.getTime() - 17 * 86400000), old_status: "draft", new_status: "active", changed_by: adminId, reason: "Готов" }
  ]
});

const bot4Id = ObjectId();
db.players.insertOne({
  _id: bot4Id,
  type: "bot",
  name: "AlphaBot",
  api_url: "http://bots.example.com/alpha",
  status: "testing",
  comment: "Нейросеть, в стадии тестирования",
  created_at: new Date(now.getTime() - 5 * 86400000),
  updated_at: new Date(now.getTime() - 2 * 86400000),
  stats: { wins: NumberInt(3), losses: NumberInt(2), draws: NumberInt(0), total_games: NumberInt(5), elo: NumberInt(0) },
  status_history: [
    { changed_at: new Date(now.getTime() - 5 * 86400000), old_status: null, new_status: "draft", changed_by: adminId, reason: "Создание" },
    { changed_at: new Date(now.getTime() - 2 * 86400000), old_status: "draft", new_status: "testing", changed_by: adminId, reason: "Начало тестирования" }
  ]
});

const bot5Id = ObjectId();
db.players.insertOne({
  _id: bot5Id,
  type: "bot",
  name: "DisabledBot",
  api_url: "http://bots.example.com/old",
  status: "disabled",
  comment: "Устаревший бот",
  created_at: new Date(now.getTime() - 60 * 86400000),
  updated_at: new Date(now.getTime() - 30 * 86400000),
  stats: { wins: NumberInt(20), losses: NumberInt(30), draws: NumberInt(5), total_games: NumberInt(55), elo: NumberInt(950) },
  status_history: [
    { changed_at: new Date(now.getTime() - 60 * 86400000), old_status: null, new_status: "draft", changed_by: adminId, reason: "Создание" },
    { changed_at: new Date(now.getTime() - 55 * 86400000), old_status: "draft", new_status: "active", changed_by: adminId, reason: "Активация" },
    { changed_at: new Date(now.getTime() - 30 * 86400000), old_status: "active", new_status: "disabled", changed_by: adminId, reason: "Устарел" }
  ]
});

// Игры==========================================================

db.games.insertOne({
  mode: "hotseat",
  status: "completed",
  player1_id: player1Id,
  player2_id: player2Id,
  winner_id: player2Id,
  result: "checkmate",
  comment: "Тестовая партия 1",
  created_at: new Date(now.getTime() - 10 * 86400000),
  updated_at: new Date(now.getTime() - 10 * 86400000),
  moves: [
    { move_number: NumberInt(1), player_id: player1Id, from_sq: "e2", to_sq: "e4", piece: "pawn", captured: null, timestamp: new Date(now.getTime() - 10 * 86400000) },
    { move_number: NumberInt(2), player_id: player2Id, from_sq: "e7", to_sq: "e5", piece: "pawn", captured: null, timestamp: new Date(now.getTime() - 10 * 86400000 + 60000) },
    { move_number: NumberInt(3), player_id: player1Id, from_sq: "f1", to_sq: "c4", piece: "bishop", captured: null, timestamp: new Date(now.getTime() - 10 * 86400000 + 120000) },
    { move_number: NumberInt(4), player_id: player2Id, from_sq: "d8", to_sq: "h4", piece: "queen", captured: null, timestamp: new Date(now.getTime() - 10 * 86400000 + 180000) }
  ],
  status_history: [
    { changed_at: new Date(now.getTime() - 10 * 86400000), old_status: null, new_status: "created", changed_by: player1Id, reason: "Создание партии" },
    { changed_at: new Date(now.getTime() - 10 * 86400000 + 1000), old_status: "created", new_status: "in_progress", changed_by: player1Id, reason: "Старт" },
    { changed_at: new Date(now.getTime() - 10 * 86400000 + 200000), old_status: "in_progress", new_status: "completed", changed_by: player2Id, reason: "Мат" }
  ]
});

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

db.games.insertOne({
  mode: "hotseat",
  status: "completed",
  player1_id: player3Id,
  player2_id: player4Id,
  winner_id: null,
  result: "draw",
  comment: "Ничья по соглашению",
  created_at: new Date(now.getTime() - 7 * 86400000),
  updated_at: new Date(now.getTime() - 7 * 86400000),
  moves: [
    { move_number: NumberInt(1), player_id: player3Id, from_sq: "c2", to_sq: "c4", piece: "pawn", captured: null, timestamp: new Date(now.getTime() - 7 * 86400000) },
    { move_number: NumberInt(2), player_id: player4Id, from_sq: "e7", to_sq: "e6", piece: "pawn", captured: null, timestamp: new Date(now.getTime() - 7 * 86400000 + 30000) }
  ],
  status_history: [
    { changed_at: new Date(now.getTime() - 7 * 86400000), old_status: null, new_status: "created", changed_by: player3Id, reason: "Создание" },
    { changed_at: new Date(now.getTime() - 7 * 86400000 + 100), old_status: "created", new_status: "in_progress", changed_by: player3Id, reason: "Старт" },
    { changed_at: new Date(now.getTime() - 7 * 86400000 + 50000), old_status: "in_progress", new_status: "completed", changed_by: player3Id, reason: "Ничья по соглашению" }
  ]
});

db.games.insertOne({
  mode: "bot",
  status: "completed",
  player1_id: player2Id,
  player2_id: bot2Id,
  winner_id: bot2Id,
  result: "checkmate",
  comment: "Игра с GreedyBot",
  created_at: new Date(now.getTime() - 6 * 86400000),
  updated_at: new Date(now.getTime() - 6 * 86400000),
  moves: [
    { move_number: NumberInt(1), player_id: player2Id, from_sq: "e2", to_sq: "e4", piece: "pawn", captured: null, timestamp: new Date(now.getTime() - 6 * 86400000) },
    { move_number: NumberInt(2), player_id: bot2Id, from_sq: "d7", to_sq: "d5", piece: "pawn", captured: null, timestamp: new Date(now.getTime() - 6 * 86400000 + 2000) },
    { move_number: NumberInt(3), player_id: player2Id, from_sq: "e4", to_sq: "d5", piece: "pawn", captured: "pawn", timestamp: new Date(now.getTime() - 6 * 86400000 + 4000) }
  ],
  status_history: [
    { changed_at: new Date(now.getTime() - 6 * 86400000), old_status: null, new_status: "created", changed_by: player2Id, reason: "Создание" },
    { changed_at: new Date(now.getTime() - 6 * 86400000 + 100), old_status: "created", new_status: "in_progress", changed_by: player2Id, reason: "Старт" },
    { changed_at: new Date(now.getTime() - 6 * 86400000 + 80000), old_status: "in_progress", new_status: "completed", changed_by: player2Id, reason: "Мат" }
  ]
});

db.games.insertOne({
  mode: "hotseat",
  status: "abandoned",
  player1_id: player1Id,
  player2_id: player3Id,
  winner_id: null,
  result: null,
  comment: "Партия брошена",
  created_at: new Date(now.getTime() - 5 * 86400000),
  updated_at: new Date(now.getTime() - 5 * 86400000 + 50000),
  moves: [
    { move_number: NumberInt(1), player_id: player1Id, from_sq: "a2", to_sq: "a4", piece: "pawn", captured: null, timestamp: new Date(now.getTime() - 5 * 86400000) }
  ],
  status_history: [
    { changed_at: new Date(now.getTime() - 5 * 86400000), old_status: null, new_status: "created", changed_by: player1Id, reason: "Создание" },
    { changed_at: new Date(now.getTime() - 5 * 86400000 + 100), old_status: "created", new_status: "in_progress", changed_by: player1Id, reason: "Старт" },
    { changed_at: new Date(now.getTime() - 5 * 86400000 + 50000), old_status: "in_progress", new_status: "abandoned", changed_by: player1Id, reason: "Игрок покинул партию" }
  ]
});

db.games.insertOne({
  mode: "bot",
  status: "completed",
  player1_id: player6Id,
  player2_id: bot3Id,
  winner_id: player6Id,
  result: "checkmate",
  comment: "Сильный игрок vs MinimaxBot",
  created_at: new Date(now.getTime() - 4 * 86400000),
  updated_at: new Date(now.getTime() - 4 * 86400000),
  moves: [
    { move_number: NumberInt(1), player_id: player6Id, from_sq: "e2", to_sq: "e4", piece: "pawn", captured: null, timestamp: new Date(now.getTime() - 4 * 86400000) },
    { move_number: NumberInt(2), player_id: bot3Id, from_sq: "c7", to_sq: "c5", piece: "pawn", captured: null, timestamp: new Date(now.getTime() - 4 * 86400000 + 3000) }
  ],
  status_history: [
    { changed_at: new Date(now.getTime() - 4 * 86400000), old_status: null, new_status: "created", changed_by: player6Id, reason: "Создание" },
    { changed_at: new Date(now.getTime() - 4 * 86400000 + 100), old_status: "created", new_status: "in_progress", changed_by: player6Id, reason: "Старт" },
    { changed_at: new Date(now.getTime() - 4 * 86400000 + 200000), old_status: "in_progress", new_status: "completed", changed_by: player6Id, reason: "Мат" }
  ]
});

db.games.insertOne({
  mode: "hotseat",
  status: "in_progress",
  player1_id: player7Id,
  player2_id: player4Id,
  winner_id: null,
  result: null,
  comment: "Текущая партия",
  created_at: new Date(now.getTime() - 1 * 86400000),
  updated_at: new Date(now.getTime() - 1 * 86400000 + 120000),
  moves: [
    { move_number: NumberInt(1), player_id: player7Id, from_sq: "d2", to_sq: "d4", piece: "pawn", captured: null, timestamp: new Date(now.getTime() - 1 * 86400000) },
    { move_number: NumberInt(2), player_id: player4Id, from_sq: "d7", to_sq: "d5", piece: "pawn", captured: null, timestamp: new Date(now.getTime() - 1 * 86400000 + 60000) },
    { move_number: NumberInt(3), player_id: player7Id, from_sq: "c1", to_sq: "f4", piece: "bishop", captured: null, timestamp: new Date(now.getTime() - 1 * 86400000 + 120000) }
  ],
  status_history: [
    { changed_at: new Date(now.getTime() - 1 * 86400000), old_status: null, new_status: "created", changed_by: player7Id, reason: "Создание" },
    { changed_at: new Date(now.getTime() - 1 * 86400000 + 100), old_status: "created", new_status: "in_progress", changed_by: player7Id, reason: "Старт" }
  ]
});

db.games.insertOne({
  mode: "bot",
  status: "completed",
  player1_id: player1Id,
  player2_id: bot3Id,
  winner_id: null,
  result: "stalemate",
  comment: "Пат с MinimaxBot",
  created_at: new Date(now.getTime() - 3 * 86400000),
  updated_at: new Date(now.getTime() - 3 * 86400000),
  moves: [
    { move_number: NumberInt(1), player_id: player1Id, from_sq: "h2", to_sq: "h4", piece: "pawn", captured: null, timestamp: new Date(now.getTime() - 3 * 86400000) }
  ],
  status_history: [
    { changed_at: new Date(now.getTime() - 3 * 86400000), old_status: null, new_status: "created", changed_by: player1Id, reason: "Создание" },
    { changed_at: new Date(now.getTime() - 3 * 86400000 + 100), old_status: "created", new_status: "in_progress", changed_by: player1Id, reason: "Старт" },
    { changed_at: new Date(now.getTime() - 3 * 86400000 + 300000), old_status: "in_progress", new_status: "completed", changed_by: player1Id, reason: "Пат" }
  ]
});

// Партия с шахом и рокировкой (демо)
db.games.insertOne({
  mode: "hotseat",
  status: "completed",
  player1_id: adminId,
  player2_id: player6Id,
  winner_id: adminId,
  result: "checkmate",
  comment: "Пример: шах и рокировка",
  created_at: new Date(now.getTime() - 2 * 86400000),
  updated_at: new Date(now.getTime() - 2 * 86400000),
  moves: [
    { move_number: NumberInt(1), player_id: adminId, from_sq: "e2", to_sq: "e4", piece: "pawn", captured: null, check: false, castling: false, timestamp: new Date(now.getTime() - 2 * 86400000) },
    { move_number: NumberInt(2), player_id: player6Id, from_sq: "e7", to_sq: "e5", piece: "pawn", captured: null, check: false, castling: false, timestamp: new Date(now.getTime() - 2 * 86400000 + 30000) },
    { move_number: NumberInt(3), player_id: adminId, from_sq: "g1", to_sq: "f3", piece: "knight", captured: null, check: false, castling: false, timestamp: new Date(now.getTime() - 2 * 86400000 + 60000) },
    { move_number: NumberInt(4), player_id: player6Id, from_sq: "b8", to_sq: "c6", piece: "knight", captured: null, check: false, castling: false, timestamp: new Date(now.getTime() - 2 * 86400000 + 90000) },
    { move_number: NumberInt(5), player_id: adminId, from_sq: "f1", to_sq: "c4", piece: "bishop", captured: null, check: false, castling: false, timestamp: new Date(now.getTime() - 2 * 86400000 + 120000) },
    { move_number: NumberInt(6), player_id: player6Id, from_sq: "g8", to_sq: "f6", piece: "knight", captured: null, check: false, castling: false, timestamp: new Date(now.getTime() - 2 * 86400000 + 150000) },
    { move_number: NumberInt(7), player_id: adminId, from_sq: "e1", to_sq: "g1", piece: "king", captured: null, check: false, castling: true, timestamp: new Date(now.getTime() - 2 * 86400000 + 180000) },
    { move_number: NumberInt(8), player_id: player6Id, from_sq: "f8", to_sq: "c5", piece: "bishop", captured: null, check: false, castling: false, timestamp: new Date(now.getTime() - 2 * 86400000 + 210000) },
    { move_number: NumberInt(9), player_id: adminId, from_sq: "d1", to_sq: "h5", piece: "queen", captured: null, check: true, castling: false, timestamp: new Date(now.getTime() - 2 * 86400000 + 240000) },
    { move_number: NumberInt(10), player_id: player6Id, from_sq: "g7", to_sq: "g6", piece: "pawn", captured: null, check: false, castling: false, timestamp: new Date(now.getTime() - 2 * 86400000 + 270000) },
    { move_number: NumberInt(11), player_id: adminId, from_sq: "h5", to_sq: "f7", piece: "queen", captured: "pawn", check: true, castling: false, timestamp: new Date(now.getTime() - 2 * 86400000 + 300000) }
  ],
  status_history: [
    { changed_at: new Date(now.getTime() - 2 * 86400000), old_status: null, new_status: "created", changed_by: adminId, reason: "Создание партии" },
    { changed_at: new Date(now.getTime() - 2 * 86400000 + 1000), old_status: "created", new_status: "in_progress", changed_by: adminId, reason: "Старт" },
    { changed_at: new Date(now.getTime() - 2 * 86400000 + 310000), old_status: "in_progress", new_status: "completed", changed_by: adminId, reason: "Мат" }
  ]
});

// Партия с рокировкой для чёрных
db.games.insertOne({
  mode: "hotseat",
  status: "completed",
  player1_id: player2Id,
  player2_id: player3Id,
  winner_id: player3Id,
  result: "checkmate",
  comment: "Пример: рокировка чёрных и шах",
  created_at: new Date(now.getTime() - 86400000),
  updated_at: new Date(now.getTime() - 86400000),
  moves: [
    { move_number: NumberInt(1), player_id: player2Id, from_sq: "d2", to_sq: "d4", piece: "pawn", captured: null, check: false, castling: false, timestamp: new Date(now.getTime() - 86400000) },
    { move_number: NumberInt(2), player_id: player3Id, from_sq: "d7", to_sq: "d5", piece: "pawn", captured: null, check: false, castling: false, timestamp: new Date(now.getTime() - 86400000 + 20000) },
    { move_number: NumberInt(3), player_id: player2Id, from_sq: "c1", to_sq: "f4", piece: "bishop", captured: null, check: false, castling: false, timestamp: new Date(now.getTime() - 86400000 + 40000) },
    { move_number: NumberInt(4), player_id: player3Id, from_sq: "c8", to_sq: "f5", piece: "bishop", captured: null, check: false, castling: false, timestamp: new Date(now.getTime() - 86400000 + 60000) },
    { move_number: NumberInt(5), player_id: player2Id, from_sq: "g1", to_sq: "f3", piece: "knight", captured: null, check: false, castling: false, timestamp: new Date(now.getTime() - 86400000 + 80000) },
    { move_number: NumberInt(6), player_id: player3Id, from_sq: "g8", to_sq: "f6", piece: "knight", captured: null, check: false, castling: false, timestamp: new Date(now.getTime() - 86400000 + 100000) },
    { move_number: NumberInt(7), player_id: player2Id, from_sq: "e2", to_sq: "e3", piece: "pawn", captured: null, check: false, castling: false, timestamp: new Date(now.getTime() - 86400000 + 120000) },
    { move_number: NumberInt(8), player_id: player3Id, from_sq: "e8", to_sq: "g8", piece: "king", captured: null, check: false, castling: true, timestamp: new Date(now.getTime() - 86400000 + 140000) },
    { move_number: NumberInt(9), player_id: player2Id, from_sq: "f1", to_sq: "b5", piece: "bishop", captured: null, check: true, castling: false, timestamp: new Date(now.getTime() - 86400000 + 160000) },
    { move_number: NumberInt(10), player_id: player3Id, from_sq: "c7", to_sq: "c6", piece: "pawn", captured: null, check: false, castling: false, timestamp: new Date(now.getTime() - 86400000 + 180000) },
    { move_number: NumberInt(11), player_id: player3Id, from_sq: "d8", to_sq: "a5", piece: "queen", captured: null, check: true, castling: false, timestamp: new Date(now.getTime() - 86400000 + 220000) }
  ],
  status_history: [
    { changed_at: new Date(now.getTime() - 86400000), old_status: null, new_status: "created", changed_by: player2Id, reason: "Создание партии" },
    { changed_at: new Date(now.getTime() - 86400000 + 1000), old_status: "created", new_status: "in_progress", changed_by: player2Id, reason: "Старт" },
    { changed_at: new Date(now.getTime() - 86400000 + 230000), old_status: "in_progress", new_status: "completed", changed_by: player3Id, reason: "Мат" }
  ]
});