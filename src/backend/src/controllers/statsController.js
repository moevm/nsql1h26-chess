const { handle } = require('../utils/handle');
const statsService = require('../services/statsService');

const overview = handle(async (req, res) => res.json(await statsService.overview()));

const schema = handle(async (req, res) => res.json(statsService.schema()));

const distribution = handle(async (req, res) => res.json(await statsService.distribution(req.query)));

module.exports = { overview, schema, distribution };
