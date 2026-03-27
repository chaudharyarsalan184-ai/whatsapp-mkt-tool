export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';
  if (status >= 500) {
    console.error(err);
  }
  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && err.stack ? { stack: err.stack } : {}),
  });
}
