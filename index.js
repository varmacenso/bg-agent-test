const http = require('http');

const handler = (req, res) => {
  res.writeHead(404);
  res.end('Not Found');
};

const withLogging = (innerHandler, logger = console.log) => (req, res) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Math.max(0, Number((end - start) / 1000000n));
    const message = `[${req.method}] ${req.url} - ${res.statusCode} in ${durationMs}ms`;
    logger(message);
  });

  innerHandler(req, res);
};

const server = http.createServer(withLogging(handler));
if (require.main === module) server.listen(3000);

module.exports = { handler, withLogging, server };
