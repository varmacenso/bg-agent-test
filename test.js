const assert = require('assert');
const { handler } = require('./index');

const run = async () => {
  const req = { method: 'GET', url: '/ping' };
  let body = '';
  const res = {
    statusCode: 200,
    headers: {},
    writeHead(code, headers = {}) {
      this.statusCode = code;
      this.headers = { ...this.headers, ...headers };
    },
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(chunk = '') {
      body += chunk;
      this.finished = true;
    },
  };

  handler(req, res);

  assert.strictEqual(res.statusCode, 200, 'status code should be 200');
  assert.strictEqual(
    res.headers['content-type'],
    'application/json',
    'content-type should be application/json'
  );
  assert.deepStrictEqual(
    JSON.parse(body),
    { pong: true },
    'response should be {pong: true}'
  );
};

run()
  .then(() => {
    console.log('OK');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
