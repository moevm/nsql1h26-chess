const { getDb } = require('../connection');

const migrations = [
  require('./001-init-schema'),
  require('./002-stats-int'),
  require('./003-player-roles'),
  require('./004-circular-chess'),
  require('./006-cc-draw-status'),
  require('./007-cc-drop-threefold'),
];

async function runMigrations() {
  const db = getDb();
  const col = db.collection('_migrations');

  const applied = await col.find({}, { projection: { version: 1 } }).toArray();
  const appliedVersions = new Set(applied.map(m => m.version));

  for (const m of migrations) {
    if (appliedVersions.has(m.version)) continue;
    console.log(`Applying migration ${m.version}: ${m.name}`);
    await m.up(db);
    await col.insertOne({
      version: m.version,
      name: m.name,
      applied_at: new Date()
    });
  }
}

module.exports = { runMigrations };
