// ABOUTME: HTTP server that only accepts GET requests.
// ABOUTME: Returns 405 Method Not Allowed for all other HTTP methods.

const http = require('http');
const handler = (req, res) => {
  if (req.method !== 'GET') {
    res.writeHead(405);
    res.end('Method Not Allowed');
    return;
  }
  res.writeHead(404);
  res.end('Not Found');
};
const server = http.createServer(handler);
if (require.main === module) server.listen(3000);
module.exports = { handler, server };
