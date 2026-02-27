// ABOUTME: Test suite for the auth API - health endpoint, user store, config, and signup.
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

function request(server, method, path, jsonBody) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const headers = {};
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
  const app = require('./index');
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

  // Cleanup
  await new Promise((resolve) => server.close(resolve));

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
