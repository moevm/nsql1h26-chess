const { getDb } = require('../db/connection');

const gamesCol = () => getDb().collection('games');

module.exports = { gamesCol };
