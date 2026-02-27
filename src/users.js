// ABOUTME: In-memory user store with create and find operations.
// ABOUTME: Provides persistence within a single process lifetime.

const crypto = require('crypto');

const users = [];

function createUser({ username, password }) {
  const user = {
    id: crypto.randomUUID(),
    username,
    password,
  };
  users.push(user);
  return user;
}

function findUserByUsername(username) {
  return users.find((u) => u.username === username);
}

function findUserById(id) {
  return users.find((u) => u.id === id);
}

module.exports = { createUser, findUserByUsername, findUserById };
