const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ObjectId, Int32 } = require('mongodb');
const { JWT_SECRET } = require('../config/env');
const { playersCol } = require('../models/playerModel');
const ApiError = require('../utils/ApiError');

const zeroStats = () => ({
  wins: new Int32(0),
  losses: new Int32(0),
  draws: new Int32(0),
  total_games: new Int32(0),
  elo: new Int32(0)
});

function signToken(player) {
  const role = player.role || 'user';
  return jwt.sign(
    { id: player._id.toString(), username: player.username, email: player.email, role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

async function login({ login, password }) {
  if (!login || !password) throw new ApiError(400, 'Введите логин и пароль');

  const player = await playersCol().findOne({
    type: 'player',
    $or: [{ username: login }, { email: login }]
  });
  if (!player) throw new ApiError(404, 'Пользователь не найден');

  const valid = await bcrypt.compare(password, player.password_hash);
  if (!valid) throw new ApiError(401, 'Неверный пароль');
  if (player.status === 'banned') throw new ApiError(403, 'Аккаунт заблокирован');

  return {
    token: signToken(player),
    user: {
      id: player._id,
      username: player.username,
      email: player.email,
      status: player.status,
      stats: player.stats,
      comment: player.comment,
      role: player.role || 'user'
    }
  };
}

async function register({ username, email, password, password_confirm }) {
  if (!username || !email || !password || !password_confirm) {
    throw new ApiError(400, 'Заполните все поля');
  }
  if (password !== password_confirm) throw new ApiError(400, 'Пароли не совпадают');
  if (username.length < 3) throw new ApiError(400, 'Логин должен содержать минимум 3 символа');
  if (password.length < 6) throw new ApiError(400, 'Пароль должен содержать минимум 6 символов');

  if (await playersCol().findOne({ type: 'player', username })) {
    throw new ApiError(409, 'Этот логин уже используется');
  }
  if (await playersCol().findOne({ type: 'player', email })) {
    throw new ApiError(409, 'Этот email уже зарегистрирован');
  }

  const hash = await bcrypt.hash(password, 10);
  const now = new Date();
  const role = 'user';

  const result = await playersCol().insertOne({
    type: 'player',
    username,
    email,
    password_hash: hash,
    role,
    status: 'active',
    comment: '',
    created_at: now,
    updated_at: now,
    stats: zeroStats(),
    status_history: [{
      changed_at: now,
      old_status: null,
      new_status: 'active',
      changed_by: null,
      reason: 'Регистрация'
    }]
  });

  const player = { _id: result.insertedId, username, email, role };
  return {
    token: signToken(player),
    user: {
      id: result.insertedId,
      username,
      email,
      status: 'active',
      role,
      stats: { wins: 0, losses: 0, draws: 0, total_games: 0, elo: 0 },
      comment: ''
    }
  };
}

async function getMe(userId) {
  const player = await playersCol().findOne({ _id: new ObjectId(userId) });
  if (!player) throw new ApiError(404, 'Пользователь не найден');

  return {
    id: player._id,
    username: player.username,
    email: player.email,
    status: player.status,
    stats: player.stats,
    comment: player.comment,
    role: player.role || 'user',
    created_at: player.created_at
  };
}

module.exports = { login, register, getMe };
