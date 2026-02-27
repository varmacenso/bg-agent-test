// ABOUTME: Express server entry point with auth endpoints (health, signup, login, me).
// ABOUTME: Exports a createApp factory for testing and starts listening when run directly.

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { createUser, findUserByEmail, findUserById } = require('./src/users');
const { JWT_SECRET, ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY } = require('./src/config');
const { saveToken, findToken, invalidateToken, revokeAllUserTokens } = require('./src/tokens');
const rateLimit = require('express-rate-limit');

function createApp() {
  const app = express();

  app.use(express.json());

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
  });

  const signupLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/auth/signup', signupLimiter, async (req, res) => {
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

  app.post('/api/auth/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body || {};

    const user = findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password || '', user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = jwt.sign({ sub: user.id, jti: crypto.randomUUID() }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });

    saveToken(refreshToken, user.id);

    res.json({ accessToken, refreshToken });
  });

  function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  app.post('/api/auth/refresh', (req, res) => {
    const { refreshToken } = req.body || {};

    // Verify JWT signature and expiry
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const stored = findToken(refreshToken);
    if (!stored) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Reuse detection: if token was already used or revoked, invalidate all user tokens
    if (stored.status !== 'active') {
      revokeAllUserTokens(stored.userId);
      return res.status(403).json({ error: 'Token reuse detected' });
    }

    // Mark old token as used
    invalidateToken(refreshToken);

    // Issue new token pair
    const newAccessToken = jwt.sign({ sub: decoded.sub, email: findUserById(decoded.sub)?.email }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const newRefreshToken = jwt.sign({ sub: decoded.sub, jti: crypto.randomUUID() }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
    saveToken(newRefreshToken, decoded.sub);

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  });

  app.post('/api/auth/logout', (req, res) => {
    const { refreshToken } = req.body || {};

    const stored = findToken(refreshToken);
    if (stored) {
      invalidateToken(refreshToken);
    }

    res.json({ message: 'Logged out' });
  });

  app.get('/api/auth/me', authenticate, (req, res) => {
    const user = findUserById(req.user.sub);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    res.json({ id: user.id, email: user.email });
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  app.listen(3000, () => {
    console.log('Server listening on port 3000');
  });
}

module.exports = createApp;
