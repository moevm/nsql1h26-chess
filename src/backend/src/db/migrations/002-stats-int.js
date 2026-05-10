module.exports = {
  version: 2,
  name: 'stats-int',
  async up(db) {
    await db.collection('players').updateMany(
      {
        $or: [
          { 'stats.wins':        { $exists: true, $not: { $type: 'int' } } },
          { 'stats.losses':      { $exists: true, $not: { $type: 'int' } } },
          { 'stats.draws':       { $exists: true, $not: { $type: 'int' } } },
          { 'stats.total_games': { $exists: true, $not: { $type: 'int' } } },
          { 'stats.elo':         { $exists: true, $not: { $type: 'int' } } }
        ]
      },
      [{
        $set: {
          'stats.wins':        { $toInt: { $ifNull: ['$stats.wins', 0] } },
          'stats.losses':      { $toInt: { $ifNull: ['$stats.losses', 0] } },
          'stats.draws':       { $toInt: { $ifNull: ['$stats.draws', 0] } },
          'stats.total_games': { $toInt: { $ifNull: ['$stats.total_games', 0] } },
          'stats.elo':         { $toInt: { $ifNull: ['$stats.elo', 0] } }
        }
      }],
      { bypassDocumentValidation: true }
    );
  }
};
