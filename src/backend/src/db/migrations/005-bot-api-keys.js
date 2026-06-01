const crypto = require('crypto');

module.exports = {
  version: 5,
  name: 'bot-api-keys',
  async up(db) {
    const bots = await db.collection('players').find({
      type: 'bot',
      $or: [{ api_key: { $exists: false } }, { api_key: null }]
    }).toArray();

    for (const bot of bots) {
      const key = crypto.randomBytes(16).toString('hex');
      await db.collection('players').updateOne(
        { _id: bot._id },
        { $set: { api_key: key, updated_at: new Date() } },
        { bypassDocumentValidation: true }
      );
      console.log(`API key for bot "${bot.name}": ${key}`);
    }

    await db.collection('players').createIndex(
      { api_key: 1 },
      {
        unique: true,
        partialFilterExpression: { type: 'bot', api_key: { $type: 'string' } },
        name: 'bot_api_key_unique'
      }
    );
  }
};
