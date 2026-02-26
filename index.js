const http = require('http');
const handler = (req, res) => {
  res.writeHead(404);
  res.end('Not Found');
};
const server = http.createServer(handler);
if (require.main === module) server.listen(3000);
module.exports = { handler, server };
