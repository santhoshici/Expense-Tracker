const { getRedis, TOKEN_BUCKET_LUA } = require('../config/redis');

function createRateLimiter({ windowMs, max, keyPrefix, message, skip }) {
  const refillPerSec = max / (windowMs / 1000);
  return async function rateLimiter(req, res, next) {
    try {
      if (skip && skip(req)) return next();
      const subject = req.user && req.user._id ? req.user._id.toString() : req.ip;
      const bucketKey = `${keyPrefix}:${subject}`;
      const now = Date.now();
      const [allowed, tokens, retryMs] = await getRedis()
        .eval(TOKEN_BUCKET_LUA, [bucketKey], [max, refillPerSec, now])
        .then((r) => {
          if (Array.isArray(r)) return [Number(r[0]), Number(r[1]), Number(r[2])];
          if (typeof r === 'string') return r.split(',').map(Number);
          return [Number(r.allowed), Number(r.tokens), Number(r.retryMs)];
        });
      const ok = Boolean(allowed);
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, Math.floor(tokens))));
      if (!ok) {
        return res.status(429).json({
          status: 429,
          error: 'Too Many Requests',
          message: message || 'Rate limit exceeded. Please try again later.',
          retryAfterSeconds: Math.ceil(retryMs / 1000),
          limit: max,
          remaining: 0,
        });
      }
      return next();
    } catch (err) {
      console.error('Rate limiter error:', err);
      return next();
    }
  };
}

const restRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  keyPrefix: 'rl:rest',
  message: 'Rate limit exceeded. Please try again later.',
});

const aiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  keyPrefix: 'rl:ai',
  message: 'AI Query rate limit exceeded.',
});

const aiDailyRateLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  max: 100,
  keyPrefix: 'rl:ai:daily',
  message: 'AI daily query limit exceeded. Try again tomorrow.',
});

module.exports = { createRateLimiter, restRateLimiter, aiRateLimiter, aiDailyRateLimiter };
