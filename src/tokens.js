// ABOUTME: In-memory refresh token store with save and find operations.
// ABOUTME: Tracks issued refresh tokens for validation and future revocation.

const tokens = [];

function saveToken(token, userId) {
  tokens.push({ token, userId });
}

function findToken(token) {
  return tokens.find((t) => t.token === token);
}

module.exports = { saveToken, findToken };
