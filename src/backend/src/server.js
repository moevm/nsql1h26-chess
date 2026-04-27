const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/circular_chess';
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}

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

// middleware для обработки jwt токенов
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Недействительный токен' });
  }
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
    } catch {}
  }
  next();
}

// роуты для аутентификации
app.post('/api/auth/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) {
      return res.status(400).json({ error: 'Введите логин и пароль' });
    }

    const player = await db.collection('players').findOne({
      type: 'player',
      $or: [
        { username: login },
        { email: login }
      ]
    });

    if (!player) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const valid = await bcrypt.compare(password, player.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Неверный пароль' });
    }

    if (player.status === 'banned') {
      return res.status(403).json({ error: 'Аккаунт заблокирован' });
    }

    const token = jwt.sign(
      { id: player._id.toString(), username: player.username, email: player.email },
      JWT_SECRET,
      { expiresIn: '24h' } // мб побольше сделать
    );

    res.json({
      token,
      user: {
        id: player._id,
        username: player.username,
        email: player.email,
        status: player.status,
        stats: player.stats,
        comment: player.comment
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, password_confirm } = req.body;

    if (!username || !email || !password || !password_confirm) {
      return res.status(400).json({ error: 'Заполните все поля' });
    }
    if (password !== password_confirm) {
      return res.status(400).json({ error: 'Пароли не совпадают' });
    }
    if (username.length < 3) {
      return res.status(400).json({ error: 'Логин должен содержать минимум 3 символа' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
    }

    const existingUsername = await db.collection('players').findOne({
      type: 'player', username: username
    });
    if (existingUsername) {
      return res.status(409).json({ error: 'Этот логин уже используется' });
    }

    const existingEmail = await db.collection('players').findOne({
      type: 'player', email: email
    });
    if (existingEmail) {
      return res.status(409).json({ error: 'Этот email уже зарегистрирован' });
    }

    const hash = await bcrypt.hash(password, 10); 
    const now = new Date();

    const result = await db.collection('players').insertOne({
      type: 'player',
      username,
      email,
      password_hash: hash,
      status: 'active',
      comment: '',
      created_at: now,
      updated_at: now,
      stats: { wins: 0, losses: 0, draws: 0, total_games: 0, elo: 0 },
      status_history: [{
        changed_at: now,
        old_status: null,
        new_status: 'active',
        changed_by: null,
        reason: 'Регистрация'
      }]
    });

    const token = jwt.sign(
      { id: result.insertedId.toString(), username, email },
      JWT_SECRET,
      { expiresIn: '24h' } // ¯\_(ツ)_/¯
    );

    res.status(201).json({
      token,
      user: {
        id: result.insertedId,
        username,
        email,
        status: 'active',
        stats: { wins: 0, losses: 0, draws: 0, total_games: 0, elo: 0},
        comment: ''
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const player = await db.collection('players').findOne({
      _id: new ObjectId(req.user.id)
    });
    if (!player) return res.status(404).json({ error: 'Пользователь не найден' });

    res.json({
      id: player._id,
      username: player.username,
      email: player.email,
      status: player.status,
      stats: player.stats,
      comment: player.comment,
      created_at: player.created_at
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});