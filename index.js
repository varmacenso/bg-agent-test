// ABOUTME: Express server entry point with health check endpoint.
// ABOUTME: Exports the Express app for testing and starts listening when run directly.

const express = require('express');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

if (require.main === module) {
  app.listen(3000, () => {
    console.log('Server listening on port 3000');
  });
}

module.exports = app;
