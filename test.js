// ABOUTME: Tests for HTTP server request handling.
// ABOUTME: Validates method filtering and response codes.

const http = require('http');
const assert = require('assert');
const { handler } = require('./index');

function createMockRes() {
  let statusCode = null;
  let body = '';
  return {
    writeHead(code) { statusCode = code; },
    end(data) { body = data || ''; },
    get statusCode() { return statusCode; },
    get body() { return body; },
  };
}

// Test: GET requests should return 404 (existing behavior)
{
  const req = { method: 'GET', url: '/' };
  const res = createMockRes();
  handler(req, res);
  assert.strictEqual(res.statusCode, 404, 'GET should return 404');
  console.log('PASS: GET returns 404');
}

// Test: POST requests should return 405
{
  const req = { method: 'POST', url: '/' };
  const res = createMockRes();
  handler(req, res);
  assert.strictEqual(res.statusCode, 405, 'POST should return 405 Method Not Allowed');
  assert.strictEqual(res.body, 'Method Not Allowed');
  console.log('PASS: POST returns 405');
}

// Test: PUT requests should return 405
{
  const req = { method: 'PUT', url: '/' };
  const res = createMockRes();
  handler(req, res);
  assert.strictEqual(res.statusCode, 405, 'PUT should return 405 Method Not Allowed');
  assert.strictEqual(res.body, 'Method Not Allowed');
  console.log('PASS: PUT returns 405');
}

// Test: DELETE requests should return 405
{
  const req = { method: 'DELETE', url: '/' };
  const res = createMockRes();
  handler(req, res);
  assert.strictEqual(res.statusCode, 405, 'DELETE should return 405 Method Not Allowed');
  assert.strictEqual(res.body, 'Method Not Allowed');
  console.log('PASS: DELETE returns 405');
}

console.log('\nAll tests passed');
process.exit(0);
