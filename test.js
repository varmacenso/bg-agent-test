const assert = require('assert');
const { EventEmitter } = require('events');

const { handler, withLogging } = require('./index');

const waitForLog = (logger) => {
  let resolveLog;
  const logPromise = new Promise((resolve) => {
    resolveLog = resolve;
  });
  const wrappedLogger = (message) => {
    logger(message);
    resolveLog(message);
  };
  return { logPromise, wrappedLogger };
};

const createMockRes = () => {
  const res = new EventEmitter();
  res.statusCode = 200;
  res.writeHead = (statusCode) => {
    res.statusCode = statusCode;
  };
  res.end = () => {
    res.emit('finish');
  };
  return res;
};

const run = async () => {
  assert.ok(typeof withLogging === 'function', 'withLogging must be exported');

  const logs = [];
  const { logPromise, wrappedLogger } = waitForLog((message) => logs.push(message));

  const req = { method: 'GET', url: '/test' };
  const res = createMockRes();

  withLogging(handler, wrappedLogger)(req, res);

  const logLine = await logPromise;

  assert.strictEqual(res.statusCode, 404);
  assert.match(logLine, /^\[GET\] \/test - 404 in \d+ms$/);
};

run().then(() => {
  console.log('All tests passed');
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
