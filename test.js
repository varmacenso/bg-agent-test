const assert = require('assert');
const { handler } = require('./index');

const createMockRes = () => {
  let statusCode = null;
  let headers = {};
  let body = '';
  let resolve;

  const done = new Promise((res) => {
    resolve = res;
  });

  const res = {
    writeHead(code, headerMap = {}) {
      statusCode = code;
      headers = { ...headers, ...headerMap };
    },
    end(chunk = '') {
      body += chunk;
      resolve({ statusCode, headers, body });
    },
  };

  return { res, done };
};

const run = async () => {
  const req = { method: 'GET', url: '/ping' };
  const { res, done } = createMockRes();

  handler(req, res);
  const response = await done;

  assert.strictEqual(response.statusCode, 200, 'expected 200 status');
  const parsed = JSON.parse(response.body);
  assert.deepStrictEqual(parsed, { pong: true }, 'expected pong payload');
  console.log('All tests passed');
};

run().catch((error) => {
  console.error('Test failure:', error.message);
  process.exit(1);
});
