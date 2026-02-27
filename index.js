// ABOUTME: Express server entry point with health check endpoint.
// ABOUTME: Exports the Express app for testing and starts listening when run directly.

const express = require('express');
const bcrypt = require('bcryptjs');
const { createUser, findUserByEmail } = require('./src/users');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  if (findUserByEmail(email)) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = createUser({ email, password: hashedPassword });

  res.status(201).json({ id: user.id, email: user.email });
});

if (require.main === module) {
  app.listen(3000, () => {
    console.log('Server listening on port 3000');
  });
}

module.exports = app;
