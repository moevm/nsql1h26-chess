const { playersCol } = require('../models/playerModel');
const { gamesCol } = require('../models/gameModel');

async function overview() {
  const [playersCount, botsCount, gamesCount, completedCount] = await Promise.all([
    playersCol().countDocuments({ type: 'player' }),
    playersCol().countDocuments({ type: 'bot' }),
    gamesCol().countDocuments(),
    gamesCol().countDocuments({ status: 'completed' })
  ]);
  return {
    players: playersCount,
    bots: botsCount,
    games: gamesCount,
    completed_games: completedCount
  };
}

module.exports = { overview };
