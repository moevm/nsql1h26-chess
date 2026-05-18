const { getDb } = require('../db/connection');

const ccGamesCol = () => getDb().collection('cc_games');

module.exports = { ccGamesCol };
