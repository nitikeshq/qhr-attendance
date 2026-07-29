const { fail } = require('../utils/responses');

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function corsOptions() {
  const developmentOrigins = [
    'http://localhost:3002', 'http://localhost:3003', 'http://localhost:8082',
    'http://127.0.0.1:3002', 'http://127.0.0.1:3003', 'http://127.0.0.1:8082',
  ];
  const configured = String(process.env.ALLOWED_ORIGINS || '')
    .split(',').map((value) => value.trim()).filter(Boolean);
  const useConfiguredOrigins = configured.length > 0 || process.env.NODE_ENV === 'production';
  const allowed = new Set(useConfiguredOrigins ? configured : developmentOrigins);
  return {
    origin(origin, callback) {
      if (!origin || allowed.has(origin)) return callback(null, true);
      const error = new Error('Origin is not allowed');
      error.status = 403;
      return callback(error);
    },
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
    maxAge: 600,
  };
}

function createRateLimiter({ windowMs, max, scope }) {
  const attempts = new Map();
  let requestCount = 0;
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test') return next();
    const now = Date.now();
    if (++requestCount % 100 === 0) {
      for (const [key, entry] of attempts) if (entry.resetAt <= now) attempts.delete(key);
    }
    const key = `${scope}:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    const current = attempts.get(key);
    const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    entry.count += 1;
    attempts.set(key, entry);
    res.set('RateLimit-Limit', String(max));
    res.set('RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    res.set('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
    if (entry.count <= max) return next();
    res.set('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
    return fail(res, 429, 'Too many requests. Please try again later.');
  };
}

module.exports = { corsOptions, createRateLimiter, positiveInteger };
