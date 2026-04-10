const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { logAudit } = require('../utils/audit');
const { requireAuth, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', authorizeRoles('admin'), async (req, res) => {
  try {
    const users = await User.find({}, { passwordHash: 0 }).sort({ createdAt: -1 }).lean();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users', error: error.message });
  }
});

router.post('/', authorizeRoles('admin'), async (req, res) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const displayName = String(req.body.displayName || '').trim();
    const password = String(req.body.password || '');
    const role = String(req.body.role || '').trim().toLowerCase();

    if (!username || !displayName || !password || !role) {
      return res.status(400).json({ message: 'Username, display name, password, and role are required' });
    }

    if (!['admin', 'data-entry', 'viewer'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      displayName,
      passwordHash,
      role,
      active: true,
    });

    await logAudit({
      req,
      entityType: 'user',
      entityId: String(user._id),
      action: 'CREATE_USER',
      userId: String(req.user.id || ''),
      userName: req.user.username || req.user.name,
      role: req.user.role,
      status: 'SUCCESS',
      description: `Created user ${username}`,
      after: { username, displayName, role, active: true },
    });

    res.status(201).json({
      id: user._id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      active: user.active,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    res.status(400).json({ message: 'Failed to create user', error: error.message });
  }
});

router.put('/:id', authorizeRoles('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isSelf = String(user._id) === String(req.user.id);
    const nextDisplayName = String(req.body.displayName ?? user.displayName).trim();
    const nextRole = String(req.body.role ?? user.role).trim().toLowerCase();
    const nextActive = typeof req.body.active === 'boolean' ? req.body.active : user.active;

    if (!nextDisplayName) {
      return res.status(400).json({ message: 'Display name is required' });
    }

    if (!['admin', 'data-entry', 'viewer'].includes(nextRole)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    if (isSelf && nextActive === false) {
      return res.status(400).json({ message: 'You cannot deactivate your own account' });
    }

    const before = user.toObject();
    user.displayName = nextDisplayName;
    if (!isSelf) {
      user.role = nextRole;
      user.active = nextActive;
    }

    await user.save();

    await logAudit({
      req,
      entityType: 'user',
      entityId: String(user._id),
      action: 'UPDATE_USER',
      userId: String(req.user.id || ''),
      userName: req.user.username || req.user.name,
      role: req.user.role,
      status: 'SUCCESS',
      description: `Updated user ${user.username}`,
      before: {
        displayName: before.displayName,
        role: before.role,
        active: before.active,
      },
      after: {
        displayName: user.displayName,
        role: user.role,
        active: user.active,
      },
    });

    res.json({
      id: user._id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      active: user.active,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    res.status(400).json({ message: 'Failed to update user', error: error.message });
  }
});

router.patch('/:id/password', authorizeRoles('admin'), async (req, res) => {
  try {
    const password = String(req.body.password || '');
    const confirmPassword = String(req.body.confirmPassword || '');

    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    await user.save();

    await logAudit({
      req,
      entityType: 'user',
      entityId: String(user._id),
      action: 'RESET_USER_PASSWORD',
      userId: String(req.user.id || ''),
      userName: req.user.username || req.user.name,
      role: req.user.role,
      status: 'SUCCESS',
      description: `Reset password for ${user.username}`,
      before: { passwordReset: false },
      after: { passwordReset: true },
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(400).json({ message: 'Failed to reset password', error: error.message });
  }
});

module.exports = router;