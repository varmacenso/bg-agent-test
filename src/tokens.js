// ABOUTME: In-memory refresh token store with rotation and reuse detection.
// ABOUTME: Tracks token status (active/used/revoked) and supports per-user invalidation.

const tokens = [];

function saveToken(token, userId) {
  tokens.push({ token, userId, status: 'active' });
}

function findToken(token) {
  return tokens.find((t) => t.token === token);
}

function invalidateToken(token) {
  const entry = tokens.find((t) => t.token === token);
  if (entry) {
    entry.status = 'used';
  }
}

function revokeAllUserTokens(userId) {
  for (const entry of tokens) {
    if (entry.userId === userId) {
      entry.status = 'revoked';
    }
  }
}

module.exports = { saveToken, findToken, invalidateToken, revokeAllUserTokens };
