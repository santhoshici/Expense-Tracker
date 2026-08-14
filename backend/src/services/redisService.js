const { getRedis } = require('../config/redis');

function wrap(impl) {
  return {
    async getKey(key) { return impl.get(key); },
    async setKey(key, value, options) { return impl.set(key, value, options); },
    async deleteKey(key) { return impl.del(key); },
    async incrKey(key) { return impl.incr(key); },
  };
}

let svc = null;
function getRedisService() {
  if (!svc) svc = wrap(getRedis());
  return svc;
}

module.exports = { getRedisService };
