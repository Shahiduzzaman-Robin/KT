const bcrypt = require('bcryptjs');
const User = require('../models/User');

const DEFAULT_USERS = [
  {
    username: 'admin',
    displayName: 'Admin User',
    password: 'admin123',
    role: 'admin',
  },
  {
    username: 'entry',
    displayName: 'Data Entry User',
    password: 'entry123',
    role: 'data-entry',
  },
  {
    username: 'viewer',
    displayName: 'Viewer User',
    password: 'viewer123',
    role: 'viewer',
  },
];

async function ensureDefaultUsers() {
  const users = [];

  for (const item of DEFAULT_USERS) {
    const passwordHash = await bcrypt.hash(item.password, 10);
    users.push({
      username: item.username,
      displayName: item.displayName,
      passwordHash,
      role: item.role,
      active: true,
    });
  }

  for (const user of users) {
    await User.findOneAndUpdate(
      { username: user.username },
      { $setOnInsert: user },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
  }

  return DEFAULT_USERS.map(({ username, displayName, role, password }) => ({
    username,
    displayName,
    role,
    password,
  }));
}

module.exports = {
  DEFAULT_USERS,
  ensureDefaultUsers,
};