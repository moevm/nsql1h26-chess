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

// роуты для данных об игроках
app.get('/api/players', optionalAuth, async (req, res) => {
  try {
    const {
      username, email, status, comment,
      wins_min, wins_max, losses_min, losses_max,
      draws_min, draws_max, total_min, total_max,
      created_from, created_to,
      sort_by, sort_dir,
      page, limit: lim
    } = req.query;

    const filter = { type: 'player' };

    if (username) filter.username = { $regex: username, $options: 'i' };
    if (email) filter.email = { $regex: email, $options: 'i' };
    if (status) filter.status = status;
    if (comment) filter.comment = { $regex: comment, $options: 'i' };

    if (wins_min || wins_max) {
      filter['stats.wins'] = {};
      if (wins_min) filter['stats.wins'].$gte = parseInt(wins_min);
      if (wins_max) filter['stats.wins'].$lte = parseInt(wins_max);
    }
    if (losses_min || losses_max) {
      filter['stats.losses'] = {};
      if (losses_min) filter['stats.losses'].$gte = parseInt(losses_min);
      if (losses_max) filter['stats.losses'].$lte = parseInt(losses_max);
    }
    if (draws_min || draws_max) {
      filter['stats.draws'] = {};
      if (draws_min) filter['stats.draws'].$gte = parseInt(draws_min);
      if (draws_max) filter['stats.draws'].$lte = parseInt(draws_max);
    }
    if (total_min || total_max) {
      filter['stats.total_games'] = {};
      if (total_min) filter['stats.total_games'].$gte = parseInt(total_min);
      if (total_max) filter['stats.total_games'].$lte = parseInt(total_max);
    }
    if (created_from || created_to) {
      filter.created_at = {};
      if (created_from) filter.created_at.$gte = new Date(created_from);
      if (created_to) filter.created_at.$lte = new Date(created_to + 'T23:59:59Z');
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(lim) || 20));
    const skip = (pageNum - 1) * limit;

    const sortField = sort_by || 'created_at';
    const sortDirection = sort_dir === 'asc' ? 1 : -1;
    const sort = { [sortField]: sortDirection }; // можно по алфавиту, наверное, сортировать

    const projection = {
      password_hash: 0
    };

    const [players, total] = await Promise.all([
      db.collection('players').find(filter).project(projection)
        .sort(sort).skip(skip).limit(limit).toArray(),
      db.collection('players').countDocuments(filter)
    ]);

    res.json({
      data: players,
      pagination: {
        page: pageNum,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Players list error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/players/:id', optionalAuth, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Некорректный ID' });
    }
    const player = await db.collection('players').findOne(
      { _id: new ObjectId(req.params.id), type: 'player' },
      { projection: { password_hash: 0 } }
    );
    if (!player) return res.status(404).json({ error: 'Игрок не найден' });
    res.json(player);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/players/:id/games', optionalAuth, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Некорректный ID' });
    }
    const playerId = new ObjectId(req.params.id);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const filter = {
      $or: [{ player1_id: playerId }, { player2_id: playerId }]
    };

    const [games, total] = await Promise.all([
      db.collection('games').find(filter)
        .project({ moves: 0 })
        .sort({ created_at: -1 })
        .skip(skip).limit(limit).toArray(),
      db.collection('games').countDocuments(filter)
    ]);

    // Подгружаем имена игроков
    const playerIds = new Set();
    games.forEach(g => {
      playerIds.add(g.player1_id.toString());
      playerIds.add(g.player2_id.toString());
      if (g.winner_id) playerIds.add(g.winner_id.toString()); // тк победителя может не быть
    });

    const players = await db.collection('players').find({
      _id: { $in: Array.from(playerIds).map(id => new ObjectId(id)) }
    }).project({ username: 1, name: 1, type: 1 }).toArray();

    const playerMap = {};
    players.forEach(p => {
      playerMap[p._id.toString()] = p.type === 'player' ? p.username : p.name;
    });

    const enriched = games.map(g => ({
      ...g,
      player1_name: playerMap[g.player1_id.toString()] || 'Неизвестен',
      player2_name: playerMap[g.player2_id.toString()] || 'Неизвестен',
      winner_name: g.winner_id ? (playerMap[g.winner_id.toString()] || 'Неизвестен') : null
    }));

    res.json({
      data: enriched,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/players/:id/status-history', optionalAuth, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Некорректный ID' });
    }
    const player = await db.collection('players').findOne(
      { _id: new ObjectId(req.params.id) },
      { projection: { status_history: 1, username: 1, name: 1, type: 1 } }
    );
    if (!player) return res.status(404).json({ error: 'Участник не найден' });

    // имена авторов изменений
    const changerIds = player.status_history
      .filter(h => h.changed_by)
      .map(h => h.changed_by);

    let changerMap = {};
    if (changerIds.length > 0) {
      const changers = await db.collection('players').find({
        _id: { $in: changerIds }
      }).project({ username: 1, name: 1, type: 1 }).toArray();
      changers.forEach(c => {
        changerMap[c._id.toString()] = c.type === 'player' ? c.username : c.name;
      });
    }

    const history = player.status_history.map(h => ({
      ...h,
      changed_by_name: h.changed_by ? (changerMap[h.changed_by.toString()] || 'Неизвестен') : null
    }));

    res.json({
      entity_name: player.type === 'player' ? player.username : player.name,
      entity_type: player.type,
      history
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// боты
app.get('/api/bots', optionalAuth, async (req, res) => {
  try {
    const {
      name, api_url, status, comment,
      wins_min, wins_max, losses_min, losses_max,
      draws_min, draws_max, total_min, total_max,
      created_from, created_to,
      sort_by, sort_dir,
      page, limit: lim
    } = req.query;

    const filter = { type: 'bot' };

    if (name) filter.name = { $regex: name, $options: 'i' };
    if (api_url) filter.api_url = { $regex: api_url, $options: 'i' };
    if (status) filter.status = status;
    if (comment) filter.comment = { $regex: comment, $options: 'i' };

    if (wins_min || wins_max) {
      filter['stats.wins'] = {};
      if (wins_min) filter['stats.wins'].$gte = parseInt(wins_min);
      if (wins_max) filter['stats.wins'].$lte = parseInt(wins_max);
    }
    if (losses_min || losses_max) {
      filter['stats.losses'] = {};
      if (losses_min) filter['stats.losses'].$gte = parseInt(losses_min);
      if (losses_max) filter['stats.losses'].$lte = parseInt(losses_max);
    }
    if (draws_min || draws_max) {
      filter['stats.draws'] = {};
      if (draws_min) filter['stats.draws'].$gte = parseInt(draws_min);
      if (draws_max) filter['stats.draws'].$lte = parseInt(draws_max);
    }
    if (total_min || total_max) {
      filter['stats.total_games'] = {};
      if (total_min) filter['stats.total_games'].$gte = parseInt(total_min);
      if (total_max) filter['stats.total_games'].$lte = parseInt(total_max);
    }
    if (created_from || created_to) {
      filter.created_at = {};
      if (created_from) filter.created_at.$gte = new Date(created_from);
      if (created_to) filter.created_at.$lte = new Date(created_to + 'T23:59:59Z');
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(lim) || 20));
    const skip = (pageNum - 1) * limit;

    const sortField = sort_by || 'created_at';
    const sortDirection = sort_dir === 'asc' ? 1 : -1;

    const [bots, total] = await Promise.all([
      db.collection('players').find(filter)
        .sort({ [sortField]: sortDirection })
        .skip(skip).limit(limit).toArray(),
      db.collection('players').countDocuments(filter)
    ]);

    res.json({
      data: bots,
      pagination: { page: pageNum, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('Bots list error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/bots/:id', optionalAuth, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Некорректный ID' });
    }
    const bot = await db.collection('players').findOne({
      _id: new ObjectId(req.params.id), type: 'bot'
    });
    if (!bot) return res.status(404).json({ error: 'Бот не найден' });
    res.json(bot);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/bots', authMiddleware, async (req, res) => {
  try {
    const { name, api_url, comment } = req.body;

    if (!name || !api_url) {
      return res.status(400).json({ error: 'Название и API URL обязательны' });
    }
    if (name.length < 2) {
      return res.status(400).json({ error: 'Название должно содержать минимум 2 символа' });
    }

    const existing = await db.collection('players').findOne({
      type: 'bot', name: name
    });
    if (existing) {
      return res.status(409).json({ error: 'Бот с таким названием уже существует' });
    }

    const now = new Date();
    const result = await db.collection('players').insertOne({
      type: 'bot',
      name,
      api_url,
      status: 'draft',
      comment: comment || '',
      created_at: now,
      updated_at: now,
      stats: { wins: 0, losses: 0, draws: 0, total_games: 0, elo: 0 },
      status_history: [{
        changed_at: now,
        old_status: null,
        new_status: 'draft',
        changed_by: new ObjectId(req.user.id),
        reason: 'Создание бота'
      }]
    });

    const bot = await db.collection('players').findOne({ _id: result.insertedId });
    res.status(201).json(bot);
  } catch (err) {
    console.error('Create bot error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.put('/api/bots/:id', authMiddleware, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Некорректный ID' });
    }

    const bot = await db.collection('players').findOne({
      _id: new ObjectId(req.params.id), type: 'bot'
    });
    if (!bot) return res.status(404).json({ error: 'Бот не найден' });

    const { name, api_url, comment, status } = req.body;
    const updates = { updated_at: new Date() };
    const pushOps = {};

    if (name !== undefined) {
      if (name.length < 2) {
        return res.status(400).json({ error: 'Название должно содержать минимум 2 символа' });
      }
      const dup = await db.collection('players').findOne({
        type: 'bot', name: name, _id: { $ne: bot._id }
      });
      if (dup) {
        return res.status(409).json({ error: 'Бот с таким названием уже существует' });
      }
      updates.name = name;
    }
    if (api_url !== undefined) updates.api_url = api_url;
    if (comment !== undefined) updates.comment = comment;

    if (status !== undefined && status !== bot.status) {
      const validStatuses = ['draft', 'testing', 'active', 'disabled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Недопустимый статус' });
      }
      updates.status = status;
      pushOps.status_history = {
        changed_at: new Date(),
        old_status: bot.status,
        new_status: status,
        changed_by: new ObjectId(req.user.id),
        reason: req.body.reason || 'Изменение статуса'
      };
    }

    const updateQuery = { $set: updates };
    if (Object.keys(pushOps).length > 0) {
      updateQuery.$push = pushOps;
    }

    await db.collection('players').updateOne(
      { _id: bot._id },
      updateQuery
    );

    const updated = await db.collection('players').findOne({ _id: bot._id });
    res.json(updated);
  } catch (err) {
    console.error('Update bot error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.delete('/api/bots/:id', authMiddleware, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Некорректный ID' });
    }

    const bot = await db.collection('players').findOne({
      _id: new ObjectId(req.params.id), type: 'bot'
    });
    if (!bot) return res.status(404).json({ error: 'Бот не найден' });

    
    const activeGame = await db.collection('games').findOne({
      status: { $in: ['created', 'in_progress'] },
      $or: [
        { player1_id: bot._id },
        { player2_id: bot._id }
      ]
    });
    if (activeGame) {
      return res.status(409).json({ error: 'Нельзя удалить бота с активными партиями' });
    }

    await db.collection('players').deleteOne({ _id: bot._id });
    res.json({ message: 'Бот удалён' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});