const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'kamrul-traders-dev-secret';

function createTokenPayload(user) {
  return {
    sub: String(user._id),
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  };
}

router.post('/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!username || !password) {
      logAudit({
        req,
        entityType: 'auth',
        entityId: username || 'unknown',
        action: 'LOGIN_FAILED',
        status: 'FAILED',
        userName: username || 'unknown',
        role: 'viewer',
        description: 'Failed login attempt with missing credentials',
        metadata: { reason: 'missing_credentials' },
      });
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = await User.findOne({ username, active: true });
    if (!user) {
      logAudit({
        req,
        entityType: 'auth',
        entityId: username,
        action: 'LOGIN_FAILED',
        status: 'FAILED',
        userName: username,
        role: 'viewer',
        description: `Failed login attempt for ${username}`,
        metadata: { reason: 'invalid_username_or_password' },
      });
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      logAudit({
        req,
        entityType: 'auth',
        entityId: String(user._id),
        action: 'LOGIN_FAILED',
        status: 'FAILED',
        userId: String(user._id),
        userName: user.username,
        role: user.role,
        description: `Failed login attempt for ${user.username}`,
        metadata: { reason: 'invalid_username_or_password' },
      });
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const token = jwt.sign(createTokenPayload(user), JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    logAudit({
      req,
      entityType: 'auth',
      entityId: String(user._id),
      action: 'LOGIN_SUCCESS',
      status: 'SUCCESS',
      userId: String(user._id),
      userName: user.username,
      role: user.role,
      description: `User ${user.username} logged in successfully`,
      metadata: { source: 'password_login' },
    });

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to login', error: error.message });
  }
});

router.post('/logout', requireAuth, async (req, res) => {
  try {
    logAudit({
      req,
      entityType: 'auth',
      entityId: String(req.user.id || ''),
      action: 'LOGOUT',
      status: 'SUCCESS',
      userId: String(req.user.id || ''),
      userName: req.user.username || req.user.name,
      role: req.user.role,
      description: `User ${req.user.username || req.user.name} logged out`,
      metadata: { source: 'client_logout' },
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to logout', error: error.message });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user || !user.active) {
      return res.status(401).json({ message: 'Session expired' });
    }

    res.json({
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load session', error: error.message });
  }
});

router.patch('/change-password', requireAuth, async (req, res) => {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const password = String(req.body.password || '');
    const confirmPassword = String(req.body.confirmPassword || '');

    if (!currentPassword || !password || !confirmPassword) {
      return res.status(400).json({ message: 'All password fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const user = await User.findById(req.user.id);
    if (!user || !user.active) {
      return res.status(401).json({ message: 'Session expired' });
    }

    const passwordMatches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordMatches) {
      logAudit({
        req,
        entityType: 'auth',
        entityId: String(user._id),
        action: 'CHANGE_PASSWORD_FAILED',
        status: 'FAILED',
        userId: String(user._id),
        userName: user.username,
        role: user.role,
        description: `Password change failed for ${user.username}`,
        metadata: { reason: 'current_password_incorrect' },
      });
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    await user.save();

    logAudit({
      req,
      entityType: 'user',
      entityId: String(user._id),
      action: 'CHANGE_PASSWORD',
      status: 'SUCCESS',
      userId: String(user._id),
      userName: user.username,
      role: user.role,
      description: `User ${user.username} changed password`,
      before: { passwordChanged: false },
      after: { passwordChanged: true },
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(400).json({ message: 'Failed to change password', error: error.message });
  }
});

module.exports = router;