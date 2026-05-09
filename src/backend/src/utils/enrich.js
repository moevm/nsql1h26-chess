const { ObjectId } = require('mongodb');
const { playersCol } = require('../models/playerModel');

async function loadPlayerNames(ids) {
  const objIds = Array.from(new Set(
    (ids || []).filter(Boolean).map(i => i.toString())
  )).map(id => new ObjectId(id));

  if (objIds.length === 0) return {};

  const players = await playersCol().find({ _id: { $in: objIds } })
    .project({ username: 1, name: 1, type: 1 })
    .toArray();

  const map = {};
  players.forEach(p => {
    map[p._id.toString()] = p.type === 'player' ? p.username : p.name;
  });
  return map;
}

module.exports = { loadPlayerNames };
