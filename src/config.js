// ABOUTME: Environment configuration with defaults for JWT and token expiry.
// ABOUTME: Centralizes auth-related settings used across the application.

module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY || '15m',
  REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || '7d',
};
