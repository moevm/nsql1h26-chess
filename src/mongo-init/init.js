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