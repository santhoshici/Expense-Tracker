const { createRateLimiter, restRateLimiter, aiRateLimiter, aiDailyRateLimiter } = require('./src/middleware/rateLimiter.js');

let passed = 0;
let failed = 0;

function makeReqRes() {
  let resHeaders = {};
  let resStatus = 200;
  let resBody = null;
  const req = { ip: '127.0.0.1', user: null };
  const res = {
    setHeader(k, v) { resHeaders[k] = v; },
    status(s) { resStatus = s; return this; },
    json(b) { resBody = b; },
  };
  const next = () => {};
  return { req, res, next, getHeaders: () => resHeaders, getStatus: () => resStatus, getBody: () => resBody,
    reset() { resHeaders = {}; resStatus = 200; resBody = null; } };
}

async function run() {
  // --- Test aiRateLimiter (max=10/60s) ---
  const ctx = makeReqRes();
  let blockedAfter = null;
  for (let i = 0; i < 15; i++) {
    ctx.reset();
    let calledNext = false;
    const next = () => { calledNext = true; };
    await aiRateLimiter(ctx.req, ctx.res, next);
    if (ctx.getStatus() === 429) {
      if (blockedAfter === null) blockedAfter = i;
      const body = ctx.getBody();
      if (body && body.status === 429 && body.error === 'Too Many Requests') {
        // correct block
      } else {
        console.log('FAIL: unexpected 429 body:', JSON.stringify(body));
        failed++;
      }
    } else if (!calledNext) {
      console.log('FAIL: request', i, 'neither called next nor returned 429');
      failed++;
    }
  }
  if (blockedAfter === 10) {
    console.log('PASS: aiRateLimiter blocked at request #' + blockedAfter + ' (expected 10)');
    passed++;
  } else {
    console.log('FAIL: aiRateLimiter blocked at request #' + blockedAfter + ' (expected 10)');
    failed++;
  }

  // --- Test restRateLimiter (max=100) — just verify it passes on first call ---
  const ctx2 = makeReqRes();
  let nextCalled = false;
  await restRateLimiter(ctx2.req, ctx2.res, () => { nextCalled = true; });
  if (nextCalled && ctx2.getStatus() === 200) {
    console.log('PASS: restRateLimiter passes first request');
    passed++;
  } else {
    console.log('FAIL: restRateLimiter first request');
    failed++;
  }

  // --- Verify headers on first successful request of FRESH limiter ---
  const freshLimiter = createRateLimiter({ windowMs: 60000, max: 20, keyPrefix: 'rl:test:headers' });
  const ctx3 = makeReqRes();
  await freshLimiter(ctx3.req, ctx3.res, () => {});
  const headers = ctx3.getHeaders();
  if (headers['X-RateLimit-Limit'] === '20' && headers['X-RateLimit-Remaining'] === '19') {
    console.log('PASS: rate limit headers correct on first request');
    passed++;
  } else {
    console.log('FAIL: headers', JSON.stringify(headers));
    failed++;
  }

  // --- Test aiDailyRateLimiter (max=100/daily) — just verify it loads and works ---
  const ctx4 = makeReqRes();
  let nextCalled4 = false;
  await aiDailyRateLimiter(ctx4.req, ctx4.res, () => { nextCalled4 = true; });
  if (nextCalled4) {
    console.log('PASS: aiDailyRateLimiter passes first request');
    passed++;
  } else {
    console.log('FAIL: aiDailyRateLimiter first request');
    failed++;
  }

  // --- Test 429 response body format ---
  const strictLimiter = createRateLimiter({ windowMs: 60000, max: 1, keyPrefix: 'rl:test:429' });
  const ctx5 = makeReqRes();
  await strictLimiter(ctx5.req, ctx5.res, () => {});
  ctx5.reset();
  let body;
  await strictLimiter(ctx5.req, ctx5.res, () => {}, (b) => { body = b; });
  if (ctx5.getStatus() === 429 && ctx5.getBody()) {
    const b = ctx5.getBody();
    if (b.status === 429 && b.error === 'Too Many Requests' && typeof b.retryAfterSeconds === 'number' && b.limit === 1 && b.remaining === 0) {
      console.log('PASS: 429 response body format correct');
      passed++;
    } else {
      console.log('FAIL: 429 body shape', JSON.stringify(b));
      failed++;
    }
  } else {
    console.log('FAIL: expected 429 status and body, got status=' + ctx5.getStatus() + ' body=' + JSON.stringify(ctx5.getBody()));
    failed++;
  }

  console.log('\nTOTAL: ' + passed + ' passed, ' + failed + ' failed');
}

run().catch(err => { console.error('Test error:', err); });
