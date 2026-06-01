const express = require('express');
const cors = require('cors');
const { PORT } = require('./config/env');
const { connectDB } = require('./db/connection');
const { runMigrations } = require('./db/migrations');
const { seedIfEmpty, seedPasswords, seedBotApiKeys } = require('./db/seed');
const apiRoutes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/api', apiRoutes);
app.use(errorHandler);

connectDB()
  .then(async () => {
    await runMigrations();
    await seedIfEmpty();
    await seedPasswords();
    await seedBotApiKeys();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to start:', err);
    process.exit(1);
  });
