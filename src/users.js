// ABOUTME: In-memory user store with create and find operations.
// ABOUTME: Provides persistence within a single process lifetime.

const crypto = require('crypto');

const users = [];

function createUser({ email, username, password }) {
  const user = {
    id: crypto.randomUUID(),
    email: email || undefined,
    username: username || undefined,
    password,
  };
  users.push(user);
  return user;
}

function findUserByEmail(email) {
  return users.find((u) => u.email === email);
}

function findUserByUsername(username) {
  return users.find((u) => u.username === username);
}

function findUserById(id) {
  return users.find((u) => u.id === id);
}

module.exports = { createUser, findUserByEmail, findUserByUsername, findUserById };
