const express = require('express');
const cors = require('cors');
const { PORT } = require('./config/env');
const { connectDB } = require('./db/connection');
const { seedRoles, seedStats, seedPasswords } = require('./db/seed');
const apiRoutes = require('./routes');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/api', apiRoutes);

connectDB()
  .then(async () => {
    await seedRoles();
    await seedStats();
    await seedPasswords();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to start:', err);
    process.exit(1);
  });
