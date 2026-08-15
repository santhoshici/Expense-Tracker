/**
 * Request Logger Middleware
 * Logs incoming HTTP requests, response status, and duration.
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();
  const { method, originalUrl } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    const level = statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO';
    console.log(`[${new Date().toISOString()}] [${level}] ${method} ${originalUrl} ${statusCode} - ${duration}ms`);
  });

  next();
};

/**
 * Centralized Express Error Handling Middleware
 * Catches unhandled errors in route handlers and controllers, logs stack traces, and formats response.
 */
const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  
  console.error(`[${new Date().toISOString()}] [EXPRESS ERROR] ${req.method} ${req.originalUrl}:`);
  console.error(err.stack || err);

  res.status(statusCode).json({
    message: err.message || 'Internal Server Error',
    error: err.name || 'Error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

module.exports = {
  requestLogger,
  errorHandler,
};
