const express = require('express');

const { verifyPassword } = require('../lib/passwords');
const { clearAdminSession, readAdminSession, writeAdminSession } = require('../lib/session');

function renderLogin(res, { status = 200, errorMessage = '', username = '' } = {}) {
  return res.status(status).render('layouts/admin', {
    title: '管理员登录',
    bodyView: '../admin/login',
    pageTitle: '管理员登录',
    pageDescription: '登录后进入中文后台总控台。',
    errorMessage,
    username,
    currentPath: '/admin/login',
    navLinks: [],
    adminSession: null,
  });
}

function createAdminAuthRouter({ adminRepository }) {
  const router = express.Router();

  router.get('/login', (req, res) => {
    if (readAdminSession(req)) {
      return res.redirect('/admin');
    }

    return renderLogin(res);
  });

  router.post('/login', async (req, res, next) => {
    try {
      const identifier = req.body?.username?.trim() || '';
      const password = req.body?.password || '';
      let admin = null;
      if (identifier) {
        // allow login by username or email for convenience
        admin = adminRepository.findByUsername(identifier) || adminRepository.findByEmail(identifier);
      }
      const passwordMatches = admin ? await verifyPassword(password, admin.passwordHash) : false;

      if (!admin || !admin.isActive || !passwordMatches) {
        return renderLogin(res, {
          status: 401,
          errorMessage: '用户名或密码不正确，请重试。',
          username,
        });
      }

      writeAdminSession(res, admin);
      return res.redirect('/admin');
    } catch (error) {
      return next(error);
    }
  });

  router.post('/logout', (req, res) => {
    clearAdminSession(res);
    res.redirect('/admin/login');
  });

  return router;
}

module.exports = {
  createAdminAuthRouter,
};
