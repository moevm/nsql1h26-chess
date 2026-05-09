function handle(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err && err.statusCode) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      console.error(err);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  };
}

module.exports = { handle };
