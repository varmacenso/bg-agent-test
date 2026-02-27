// ABOUTME: Test suite for the auth API - health, signup, login, JWT, and protected endpoints.
// ABOUTME: Uses Node.js built-in assert and http for testing without external test frameworks.

const assert = require('assert');
const http = require('http');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

function request(server, method, path, jsonBody, opts = {}) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const headers = {};
    if (opts.authorization) {
      headers['Authorization'] = opts.authorization;
    }
    let payload;
    if (jsonBody !== undefined) {
      payload = JSON.stringify(jsonBody);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request({ hostname: '127.0.0.1', port: addr.port, method, path, headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function run() {
  console.log('US-001 Tests\n');

  // --- Health endpoint tests ---
  console.log('Health Endpoint:');
  const createApp = require('./index');
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  await test('GET /health returns 200', async () => {
    const res = await request(server, 'GET', '/health');
    assert.strictEqual(res.status, 200);
  });

  await test('GET /health returns {"status":"ok"}', async () => {
    const res = await request(server, 'GET', '/health');
    const json = JSON.parse(res.body);
    assert.deepStrictEqual(json, { status: 'ok' });
  });

  await test('GET /health returns JSON content-type', async () => {
    const res = await request(server, 'GET', '/health');
    assert.ok(res.headers['content-type'].includes('application/json'));
  });

  // --- User store tests ---
  console.log('\nUser Store:');
  const userStore = require('./src/users');

  await test('createUser adds a user and returns it', async () => {
    const user = await userStore.createUser({ username: 'alice', password: 'hashed123' });
    assert.ok(user);
    assert.strictEqual(user.username, 'alice');
    assert.ok(user.id, 'user should have an id');
  });

  await test('findUserByUsername returns the created user', async () => {
    const user = userStore.findUserByUsername('alice');
    assert.ok(user);
    assert.strictEqual(user.username, 'alice');
  });

  await test('findUserByUsername returns undefined for unknown user', () => {
    const user = userStore.findUserByUsername('nobody');
    assert.strictEqual(user, undefined);
  });

  await test('findUserById returns the created user', async () => {
    const created = await userStore.createUser({ username: 'bob', password: 'hashed456' });
    const found = userStore.findUserById(created.id);
    assert.ok(found);
    assert.strictEqual(found.username, 'bob');
  });

  // --- Config tests ---
  console.log('\nConfig:');
  const config = require('./src/config');

  await test('exports JWT_SECRET with a default', () => {
    assert.ok(config.JWT_SECRET);
    assert.strictEqual(typeof config.JWT_SECRET, 'string');
  });

  await test('exports ACCESS_TOKEN_EXPIRY as 15m', () => {
    assert.strictEqual(config.ACCESS_TOKEN_EXPIRY, '15m');
  });

  await test('exports REFRESH_TOKEN_EXPIRY as 7d', () => {
    assert.strictEqual(config.REFRESH_TOKEN_EXPIRY, '7d');
  });

  // --- Dependencies check ---
  console.log('\nDependencies:');
  const pkg = require('./package.json');

  await test('express is a dependency', () => {
    assert.ok(pkg.dependencies.express);
  });

  await test('bcryptjs is a dependency', () => {
    assert.ok(pkg.dependencies.bcryptjs);
  });

  await test('jsonwebtoken is a dependency', () => {
    assert.ok(pkg.dependencies.jsonwebtoken);
  });

  await test('express-rate-limit is a dependency', () => {
    assert.ok(pkg.dependencies['express-rate-limit']);
  });

  // --- Signup endpoint tests (US-002) ---
  console.log('\nSignup Endpoint:');

  await test('POST /api/auth/signup with valid data returns 201 and {id, email}', async () => {
    const res = await request(server, 'POST', '/api/auth/signup', {
      email: 'test@example.com',
      password: 'password123',
    });
    assert.strictEqual(res.status, 201);
    const json = JSON.parse(res.body);
    assert.ok(json.id, 'response should have id');
    assert.strictEqual(json.email, 'test@example.com');
    assert.strictEqual(json.password, undefined, 'password must not be in response');
  });

  await test('Signup stores password hashed with bcrypt (cost >= 10)', async () => {
    const { findUserByEmail } = require('./src/users');
    const user = findUserByEmail('test@example.com');
    assert.ok(user, 'user should exist in store');
    assert.notStrictEqual(user.password, 'password123', 'password must be hashed');
    // bcrypt hashes start with $2a$ or $2b$ and contain the cost factor
    assert.ok(/^\$2[ab]\$\d{2}\$/.test(user.password), 'password should be a bcrypt hash');
    const cost = parseInt(user.password.split('$')[2], 10);
    assert.ok(cost >= 10, `bcrypt cost should be >= 10, got ${cost}`);
  });

  await test('POST /api/auth/signup with duplicate email returns 409', async () => {
    const res = await request(server, 'POST', '/api/auth/signup', {
      email: 'test@example.com',
      password: 'anotherpass123',
    });
    assert.strictEqual(res.status, 409);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.error, 'Email already registered');
  });

  await test('POST /api/auth/signup with missing email returns 400', async () => {
    const res = await request(server, 'POST', '/api/auth/signup', {
      password: 'password123',
    });
    assert.strictEqual(res.status, 400);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.error, 'Email and password are required');
  });

  await test('POST /api/auth/signup with missing password returns 400', async () => {
    const res = await request(server, 'POST', '/api/auth/signup', {
      email: 'another@example.com',
    });
    assert.strictEqual(res.status, 400);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.error, 'Email and password are required');
  });

  await test('POST /api/auth/signup with short password returns 400', async () => {
    const res = await request(server, 'POST', '/api/auth/signup', {
      email: 'short@example.com',
      password: 'short',
    });
    assert.strictEqual(res.status, 400);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.error, 'Password must be at least 8 characters');
  });

  // --- Login endpoint tests (US-003) ---
  // Fresh server to reset rate limiter counters
  await new Promise((resolve) => server.close(resolve));
  const loginApp = createApp();
  const loginServer = await new Promise((resolve) => {
    const s = loginApp.listen(0, '127.0.0.1', () => resolve(s));
  });

  console.log('\nLogin Endpoint:');
  const jwt = require('jsonwebtoken');

  // Sign up a user for login tests
  await request(loginServer, 'POST', '/api/auth/signup', {
    email: 'login@example.com',
    password: 'loginpass123',
  });

  await test('POST /api/auth/login with valid credentials returns 200 and tokens', async () => {
    const res = await request(loginServer, 'POST', '/api/auth/login', {
      email: 'login@example.com',
      password: 'loginpass123',
    });
    assert.strictEqual(res.status, 200);
    const json = JSON.parse(res.body);
    assert.ok(json.accessToken, 'response should have accessToken');
    assert.ok(json.refreshToken, 'response should have refreshToken');
  });

  await test('Access token is a signed JWT with sub and email, 15m expiry', async () => {
    const res = await request(loginServer, 'POST', '/api/auth/login', {
      email: 'login@example.com',
      password: 'loginpass123',
    });
    const json = JSON.parse(res.body);
    const decoded = jwt.verify(json.accessToken, config.JWT_SECRET);
    assert.ok(decoded.sub, 'access token should have sub claim');
    assert.strictEqual(decoded.email, 'login@example.com');
    // 15m = 900s; check exp - iat is approximately 900
    const ttl = decoded.exp - decoded.iat;
    assert.ok(ttl >= 899 && ttl <= 901, `access token TTL should be ~900s, got ${ttl}`);
  });

  await test('Refresh token is a signed JWT with 7d expiry', async () => {
    const res = await request(loginServer, 'POST', '/api/auth/login', {
      email: 'login@example.com',
      password: 'loginpass123',
    });
    const json = JSON.parse(res.body);
    const decoded = jwt.verify(json.refreshToken, config.JWT_SECRET);
    assert.ok(decoded.sub, 'refresh token should have sub claim');
    const ttl = decoded.exp - decoded.iat;
    const sevenDays = 7 * 24 * 60 * 60;
    assert.ok(ttl >= sevenDays - 1 && ttl <= sevenDays + 1, `refresh token TTL should be ~${sevenDays}s, got ${ttl}`);
  });

  await test('Refresh token is stored in the server-side token store', async () => {
    const { findToken } = require('./src/tokens');
    const res = await request(loginServer, 'POST', '/api/auth/login', {
      email: 'login@example.com',
      password: 'loginpass123',
    });
    const json = JSON.parse(res.body);
    const stored = findToken(json.refreshToken);
    assert.ok(stored, 'refresh token should be in the token store');
  });

  await test('POST /api/auth/login with wrong password returns 401', async () => {
    const res = await request(loginServer, 'POST', '/api/auth/login', {
      email: 'login@example.com',
      password: 'wrongpassword',
    });
    assert.strictEqual(res.status, 401);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.error, 'Invalid credentials');
  });

  await test('POST /api/auth/login with non-existent email returns 401', async () => {
    const res = await request(loginServer, 'POST', '/api/auth/login', {
      email: 'nobody@example.com',
      password: 'password123',
    });
    assert.strictEqual(res.status, 401);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.error, 'Invalid credentials');
  });

  // --- Protected /me endpoint tests (US-003) ---
  console.log('\nProtected /me Endpoint:');

  await test('GET /api/auth/me with valid Bearer token returns 200 and {id, email}', async () => {
    const loginRes = await request(loginServer, 'POST', '/api/auth/login', {
      email: 'login@example.com',
      password: 'loginpass123',
    });
    const { accessToken } = JSON.parse(loginRes.body);
    const res = await request(loginServer, 'GET', '/api/auth/me', undefined, {
      authorization: `Bearer ${accessToken}`,
    });
    assert.strictEqual(res.status, 200);
    const json = JSON.parse(res.body);
    assert.ok(json.id, 'response should have id');
    assert.strictEqual(json.email, 'login@example.com');
    assert.strictEqual(json.password, undefined, 'password must not be in response');
  });

  await test('GET /api/auth/me without token returns 401', async () => {
    const res = await request(loginServer, 'GET', '/api/auth/me');
    assert.strictEqual(res.status, 401);
  });

  await test('GET /api/auth/me with invalid token returns 401', async () => {
    const res = await request(loginServer, 'GET', '/api/auth/me', undefined, {
      authorization: 'Bearer invalid.token.here',
    });
    assert.strictEqual(res.status, 401);
  });

  // --- Refresh token rotation tests (US-004) ---
  // Fresh server to reset rate limiter counters
  await new Promise((resolve) => loginServer.close(resolve));
  const refreshApp = createApp();
  const refreshServer = await new Promise((resolve) => {
    const s = refreshApp.listen(0, '127.0.0.1', () => resolve(s));
  });

  console.log('\nRefresh Token Rotation:');

  // Sign up and login a fresh user for refresh tests
  await request(refreshServer, 'POST', '/api/auth/signup', {
    email: 'refresh@example.com',
    password: 'refreshpass123',
  });
  const refreshLoginRes = await request(refreshServer, 'POST', '/api/auth/login', {
    email: 'refresh@example.com',
    password: 'refreshpass123',
  });
  const refreshLoginJson = JSON.parse(refreshLoginRes.body);

  await test('POST /api/auth/refresh with valid refreshToken returns 200 and new tokens', async () => {
    const res = await request(refreshServer, 'POST', '/api/auth/refresh', {
      refreshToken: refreshLoginJson.refreshToken,
    });
    assert.strictEqual(res.status, 200);
    const json = JSON.parse(res.body);
    assert.ok(json.accessToken, 'response should have accessToken');
    assert.ok(json.refreshToken, 'response should have refreshToken');
    assert.notStrictEqual(json.refreshToken, refreshLoginJson.refreshToken, 'new refresh token should differ');
  });

  await test('Old refresh token is invalidated after rotation and cannot be reused', async () => {
    // Login again to get a fresh token pair
    const loginRes = await request(refreshServer, 'POST', '/api/auth/login', {
      email: 'refresh@example.com',
      password: 'refreshpass123',
    });
    const { refreshToken: original } = JSON.parse(loginRes.body);

    // Rotate once - should succeed
    const rotateRes = await request(refreshServer, 'POST', '/api/auth/refresh', {
      refreshToken: original,
    });
    assert.strictEqual(rotateRes.status, 200);

    // Try to reuse the original - should fail with 403
    const reuseRes = await request(refreshServer, 'POST', '/api/auth/refresh', {
      refreshToken: original,
    });
    assert.strictEqual(reuseRes.status, 403);
    const json = JSON.parse(reuseRes.body);
    assert.strictEqual(json.error, 'Token reuse detected');
  });

  await test('Reuse of rotated token invalidates all tokens for that user', async () => {
    // Login to get fresh tokens
    const loginRes = await request(refreshServer, 'POST', '/api/auth/login', {
      email: 'refresh@example.com',
      password: 'refreshpass123',
    });
    const { refreshToken: original } = JSON.parse(loginRes.body);

    // Rotate to get a new token
    const rotateRes = await request(refreshServer, 'POST', '/api/auth/refresh', {
      refreshToken: original,
    });
    const { refreshToken: rotated } = JSON.parse(rotateRes.body);

    // Reuse the original (triggers reuse detection)
    const reuseRes = await request(refreshServer, 'POST', '/api/auth/refresh', {
      refreshToken: original,
    });
    assert.strictEqual(reuseRes.status, 403);

    // Now the rotated token should also be invalidated
    const rotatedRes = await request(refreshServer, 'POST', '/api/auth/refresh', {
      refreshToken: rotated,
    });
    assert.strictEqual(rotatedRes.status, 403);
  });

  await test('POST /api/auth/refresh with expired or invalid token returns 401', async () => {
    const res = await request(refreshServer, 'POST', '/api/auth/refresh', {
      refreshToken: 'invalid.token.here',
    });
    assert.strictEqual(res.status, 401);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.error, 'Invalid refresh token');
  });

  // --- Logout tests (US-004) ---
  console.log('\nLogout:');

  await test('POST /api/auth/logout with valid refresh token returns 200', async () => {
    const loginRes = await request(refreshServer, 'POST', '/api/auth/login', {
      email: 'refresh@example.com',
      password: 'refreshpass123',
    });
    const { refreshToken } = JSON.parse(loginRes.body);

    const res = await request(refreshServer, 'POST', '/api/auth/logout', {
      refreshToken,
    });
    assert.strictEqual(res.status, 200);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.message, 'Logged out');

    // The token should no longer work for refresh
    const refreshRes = await request(refreshServer, 'POST', '/api/auth/refresh', {
      refreshToken,
    });
    assert.strictEqual(refreshRes.status, 403);
  });

  // --- Rate limiting tests (US-005) ---
  // Use a fresh server so rate limit counters start at zero
  await new Promise((resolve) => refreshServer.close(resolve));
  console.log('\nRate Limiting:');

  const rateLimitApp = createApp();
  const rateLimitServer = await new Promise((resolve) => {
    const s = rateLimitApp.listen(0, '127.0.0.1', () => resolve(s));
  });

  // Sign up a user for login rate limit tests
  await request(rateLimitServer, 'POST', '/api/auth/signup', {
    email: 'ratelimit@example.com',
    password: 'ratelimitpass123',
  });

  await test('POST /api/auth/login is limited to 10 requests per 15-minute window', async () => {
    // Send 10 requests (should all succeed or return valid auth responses)
    for (let i = 0; i < 10; i++) {
      const res = await request(rateLimitServer, 'POST', '/api/auth/login', {
        email: 'ratelimit@example.com',
        password: 'ratelimitpass123',
      });
      assert.strictEqual(res.status, 200, `request ${i + 1} should succeed`);
    }
    // 11th request should be rate limited
    const res = await request(rateLimitServer, 'POST', '/api/auth/login', {
      email: 'ratelimit@example.com',
      password: 'ratelimitpass123',
    });
    assert.strictEqual(res.status, 429);
  });

  await test('Rate limited response returns correct error JSON', async () => {
    const res = await request(rateLimitServer, 'POST', '/api/auth/login', {
      email: 'ratelimit@example.com',
      password: 'ratelimitpass123',
    });
    assert.strictEqual(res.status, 429);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.error, 'Too many requests, please try again later');
  });

  await test('Rate limited response includes Retry-After header', async () => {
    const res = await request(rateLimitServer, 'POST', '/api/auth/login', {
      email: 'ratelimit@example.com',
      password: 'ratelimitpass123',
    });
    assert.strictEqual(res.status, 429);
    assert.ok(res.headers['retry-after'], 'response should have Retry-After header');
  });

  // Fresh server for signup rate limit test
  await new Promise((resolve) => rateLimitServer.close(resolve));
  const signupApp = createApp();
  const signupServer = await new Promise((resolve) => {
    const s = signupApp.listen(0, '127.0.0.1', () => resolve(s));
  });

  await test('POST /api/auth/signup is limited to 5 requests per 15-minute window', async () => {
    // Send 5 signup requests (should succeed or return 409 for duplicates, but not 429)
    for (let i = 0; i < 5; i++) {
      const res = await request(signupServer, 'POST', '/api/auth/signup', {
        email: `signuplimit${i}@example.com`,
        password: 'password123',
      });
      assert.notStrictEqual(res.status, 429, `request ${i + 1} should not be rate limited`);
    }
    // 6th request should be rate limited
    const res = await request(signupServer, 'POST', '/api/auth/signup', {
      email: 'signuplimit5@example.com',
      password: 'password123',
    });
    assert.strictEqual(res.status, 429);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.error, 'Too many requests, please try again later');
  });

  await test('Signup rate limit response includes Retry-After header', async () => {
    const res = await request(signupServer, 'POST', '/api/auth/signup', {
      email: 'signuplimit6@example.com',
      password: 'password123',
    });
    assert.strictEqual(res.status, 429);
    assert.ok(res.headers['retry-after'], 'response should have Retry-After header');
  });

  await test('GET /health is not rate limited by auth limiter', async () => {
    // Even though auth endpoints are exhausted, /health should still work
    for (let i = 0; i < 20; i++) {
      const res = await request(signupServer, 'GET', '/health');
      assert.strictEqual(res.status, 200, `health request ${i + 1} should not be rate limited`);
    }
  });

  // Cleanup
  await new Promise((resolve) => signupServer.close(resolve));

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
