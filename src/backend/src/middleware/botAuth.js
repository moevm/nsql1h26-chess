const { playersCol } = require('../models/playerModel');

async function botAuth(req, res, next) {
  try {
    const key = req.headers['x-bot-key'];
    if (!key || typeof key !== 'string') {
      return res.status(401).json({ error: 'Требуется заголовок X-Bot-Key' });
    }
    const bot = await playersCol().findOne({ type: 'bot', api_key: key });
    if (!bot) {
      return res.status(401).json({ error: 'Недействительный ключ бота' });
    }
    if (bot.status !== 'active') {
      return res.status(403).json({ error: 'Бот неактивен' });
    }
    req.bot = bot;
    next();
  } catch (err) {
    next(err);
  }
}

async function botOrUserAuth(req, res, next) {
  const key = req.headers['x-bot-key'];
  if (key) return botAuth(req, res, next);
  const { authMiddleware } = require('./auth');
  return authMiddleware(req, res, next);
}

module.exports = { botAuth, botOrUserAuth };
