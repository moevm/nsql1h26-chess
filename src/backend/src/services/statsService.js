const { playersCol } = require('../models/playerModel');
const { ccGamesCol } = require('../models/circularChessModel');

const TERMINAL_STATUSES = ['checkmate', 'stalemate', 'resigned', 'draw', 'abandoned'];

async function overview() {
  const [playersCount, botsCount, gamesCount, completedCount] = await Promise.all([
    playersCol().countDocuments({ type: 'player' }),
    playersCol().countDocuments({ type: 'bot' }),
    ccGamesCol().countDocuments(),
    ccGamesCol().countDocuments({ status: { $in: TERMINAL_STATUSES } })
  ]);
  return {
    players: playersCount,
    bots: botsCount,
    games: gamesCount,
    completed_games: completedCount
  };
}

module.exports = { overview };
