const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/circular_chess';
const PORT = process.env.PORT || 3000;

let db;

// ===================== DB CONNECTION =====================

async function connectDB() {
  let retries = 10;
  while (retries > 0) {
    try {
      const client = new MongoClient(MONGO_URI);
      await client.connect();
      db = client.db();
      console.log('Connected to MongoDB');
      await seedPasswords();
      return;
    } catch (err) {
      retries--;
      console.log(`DB connection failed, retries left: ${retries}`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  throw new Error('Could not connect to MongoDB');
}

async function seedPasswords() {
  const players = await db.collection('players').find({
    type: 'player',
    password_hash: '__SEED__'
  }).toArray();

  for (const p of players) {
    let password;
    if (p.username === 'admin') password = 'admin123';
    else password = 'player123';

    const hash = await bcrypt.hash(password, 10);
    await db.collection('players').updateOne(
      { _id: p._id },
      { $set: { password_hash: hash, updated_at: new Date() } }
    );
    console.log(`Seeded password for ${p.username}`);
  }
}