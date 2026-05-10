module.exports = {
  version: 3,
  name: 'player-roles',
  async up(db) {
    await db.collection('players').updateMany(
      { type: 'player', role: { $exists: false } },
      [{
        $set: {
          role: { $cond: [{ $eq: ['$username', 'admin'] }, 'admin', 'user'] }
        }
      }],
      { bypassDocumentValidation: true }
    );
  }
};
