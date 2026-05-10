const { handle } = require('../utils/handle');
const statsService = require('../services/statsService');

const overview = handle(async (req, res) => res.json(await statsService.overview()));

module.exports = { overview };
