function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const status = err && err.statusCode ? err.statusCode : 500;
  if (status >= 500) console.error(err);

  const message = status >= 500
    ? 'Ошибка сервера'
    : (err && err.message) || 'Ошибка сервера';

  res.status(status).json({ error: message });
}

module.exports = { errorHandler };
