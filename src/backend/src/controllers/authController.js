const { handle } = require('../utils/handle');
const authService = require('../services/authService');

const login = handle(async (req, res) => {
  res.json(await authService.login(req.body));
});

const register = handle(async (req, res) => {
  res.status(201).json(await authService.register(req.body));
});

const me = handle(async (req, res) => {
  res.json(await authService.getMe(req.user.id));
});

module.exports = { login, register, me };
