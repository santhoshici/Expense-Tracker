const EventEmitter = require('events');

let redisClient = null;
let memoryStore = null;

const TOKEN_BUCKET_LUA = `
local tokens = tonumber(redis.call('GET', KEYS[1]) or ARGV[1])
local last = tonumber(redis.call('GET', KEYS[1]..':ts') or ARGV[3])
local refill = (ARGV[3] - last) * tonumber(ARGV[2])
tokens = math.min(tonumber(ARGV[1]), tokens + refill)
local allowed = 0
local retryMs = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
else
  retryMs = math.ceil((1 - tokens) / tonumber(ARGV[2])) * 1000
end
redis.call('SET', KEYS[1], tokens)
redis.call('SET', KEYS[1]..':ts', ARGV[3])
return {allowed, tokens, retryMs}
`;

function createMemoryStore() {
  const store = new Map();
  const timers = new Map();

  function scheduleExpiry(key, ms) {
    if (timers.has(key)) {
      clearTimeout(timers.get(key));
    }
    if (ms > 0) {
      const t = setTimeout(() => {
        store.delete(key);
        timers.delete(key);
      }, ms);
      if (t.unref) t.unref();
      timers.set(key, t);
    }
  }

  function expireKey(key, seconds) {
    const val = store.get(key);
    if (val !== undefined) scheduleExpiry(key, seconds * 1000);
  }

  return {
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async set(key, value, options) {
      let ttlMs = 0;
      if (options && typeof options === 'object') {
        if (options.PX) ttlMs = Number(options.PX);
        else if (options.EX) ttlMs = Number(options.EX) * 1000;
      }
      store.set(key, String(value));
      if (ttlMs > 0) scheduleExpiry(key, ttlMs);
      else scheduleExpiry(key, 0);
      return 'OK';
    },
    async del(key) {
      const existed = store.delete(key);
      if (timers.has(key)) {
        clearTimeout(timers.get(key));
        timers.delete(key);
      }
      return existed ? 1 : 0;
    },
    async incr(key) {
      const next = (Number(store.get(key)) || 0) + 1;
      store.set(key, String(next));
      if (!timers.has(key)) scheduleExpiry(key, 0);
      return next;
    },
    async expire(key, seconds) {
      if (!store.has(key)) return 0;
      expireKey(key, seconds);
      return 1;
    },
    async close() {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
      store.clear();
    },
    async eval(script, keys, args) {
      const key = keys[0];
      const readNum = (k) => {
        const v = store.get(k);
        return v === undefined || v === null ? null : Number(v);
      };
      let tokens = readNum(key);
      if (tokens === null) tokens = Number(args[0]);
      let last = readNum(key + ':ts');
      if (last === null) last = Number(args[2]);
      const now = Number(args[2]);
      const capacity = Number(args[0]);
      const refillRate = Number(args[1]);
      const refill = (now - last) * refillRate;
      tokens = Math.min(capacity, tokens + refill);
      let allowed = 0;
      let retryMs = 0;
      if (tokens >= 1) {
        tokens = tokens - 1;
        allowed = 1;
      } else {
        retryMs = Math.ceil((1 - tokens) / refillRate) * 1000;
      }
      store.set(key, String(tokens));
      store.set(key + ':ts', String(now));
      return [allowed, tokens, retryMs];
    },
  };
}

function getRedis() {
  if (redisClient) return redisClient;
  if (memoryStore) return memoryStore;
  if (process.env.REDIS_URL) {
    try {
      const Redis = require('ioredis');
      const client = new Redis(process.env.REDIS_URL, { lazyConnect: false });
      client.on('error', () => {});
      redisClient = {
        async eval(script, keys, args) {
          const res = await client.eval(script, keys.length, ...keys, ...args);
          return res;
        },
        async get(key) { return client.get(key); },
        async set(key, value, options) { return client.set(key, value, options); },
        async del(key) { return client.del(key); },
        async incr(key) { return client.incr(key); },
        async expire(key, seconds) { return client.expire(key, seconds); },
        async close() { await client.quit(); redisClient = null; },
      };
      return redisClient;
    } catch (err) {
      console.warn('⚠️ Redis unavailable — falling back to in-memory store (rate limiting is per-process only).');
      memoryStore = createMemoryStore();
      return memoryStore;
    }
  }
  console.warn('⚠️ Redis unavailable — falling back to in-memory store (rate limiting is per-process only).');
  memoryStore = createMemoryStore();
  return memoryStore;
}

function isRedisAvailable() {
  if (redisClient) return true;
  if (memoryStore) return false;
  if (!process.env.REDIS_URL) return false;
  try {
    require.resolve('ioredis');
  } catch (err) {
    return false;
  }
  return true;
}

module.exports = { getRedis, isRedisAvailable, TOKEN_BUCKET_LUA };
