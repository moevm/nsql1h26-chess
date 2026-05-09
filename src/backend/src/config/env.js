const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/circular_chess';
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}

module.exports = { MONGO_URI, PORT, JWT_SECRET };
