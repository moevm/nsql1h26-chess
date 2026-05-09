const { ObjectId } = require('mongodb');
const { getDb } = require('../db/connection');

const playersCol = () => getDb().collection('players');

module.exports = { playersCol, ObjectId };
