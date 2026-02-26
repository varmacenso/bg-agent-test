const http = require('http');

const handler = (req, res) => {
  if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ pong: true }));
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
};

const server = http.createServer(handler);
if (require.main === module) server.listen(3000);
module.exports = { handler, server };
