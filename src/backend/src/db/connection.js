const { MongoClient } = require('mongodb');
const { MONGO_URI } = require('../config/env');

let db = null;

async function connectDB() {
  let retries = 10;
  while (retries > 0) {
    try {
      const client = new MongoClient(MONGO_URI);
      await client.connect();
      db = client.db();
      console.log('Connected to MongoDB');
      return db;
    } catch (err) {
      retries--;
      console.log(`DB connection failed, retries left: ${retries}`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  throw new Error('Could not connect to MongoDB');
}

function getDb() {
  if (!db) throw new Error('DB not initialized');
  return db;
}

module.exports = { connectDB, getDb };
