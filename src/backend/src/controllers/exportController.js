const { handle } = require('../utils/handle');
const exportService = require('../services/exportService');

const exportAll = handle(async (req, res) => {
  const data = await exportService.exportAll();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="chess-export-${Date.now()}.json"`);
  res.json(data);
});

const importAll = handle(async (req, res) => {
  res.json(await exportService.importAll(req.body));
});

module.exports = { exportAll, importAll };
