const { playersCol } = require('../models/playerModel');
const { ccGamesCol } = require('../models/circularChessModel');

// Партия считается завершённой, когда достигнут терминальный статус.
const TERMINAL_STATUSES = ['checkmate', 'stalemate', 'threefold', 'resigned', 'draw', 'abandoned'];

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
