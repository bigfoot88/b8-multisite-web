const express = require('express');

const { sites } = require('../config/sites');
const { requireAdmin } = require('../lib/session');

const navLinks = [
  {
    key: 'dma',
    href: '/admin/dma',
    label: 'DMA 站点',
    description: '查看 DMA 站点的内容入口与维护位。',
  },
  {
    key: 'bigfoot',
    href: '/admin/bigfoot',
    label: '同创站点',
    description: '查看 Bigfoot 中文站点的栏目入口。',
  },
  {
    key: 'media',
    href: '/admin/media',
    label: '媒体库',
    description: '统一管理图片、附件与下载素材。',
  },
];

function buildDashboardModel(currentSection, adminSession) {
  const activeNav = navLinks.find((link) => link.key === currentSection) || null;
  const siteSummaries = sites.map((siteKey) => {
    const link = navLinks.find((item) => item.key === siteKey);
    return {
      siteKey,
      href: link.href,
      label: link.label,
      description: link.description,
    };
  });

  return {
    title: activeNav ? `${activeNav.label} · 中文后台` : '中文后台总控台',
    bodyView: '../admin/dashboard',
    pageTitle: activeNav ? activeNav.label : '中文后台总控台',
    pageDescription: activeNav
      ? `${activeNav.description} 当前仅提供登录后的导航壳层。`
      : '欢迎进入 B8 中文后台。请选择左侧入口继续。',
    currentPath: activeNav?.href || '/admin',
    currentSection,
    navLinks,
    siteSummaries,
    adminSession,
  };
}

function createAdminDashboardRouter() {
  const router = express.Router();

  router.use(requireAdmin);

  router.get('/', (req, res) => {
    res.render('layouts/admin', buildDashboardModel(null, req.adminSession));
  });

  router.get('/media', (req, res) => {
    res.render('layouts/admin', buildDashboardModel('media', req.adminSession));
  });

  router.get('/:siteKey', (req, res) => {
    if (!sites.includes(req.params.siteKey)) {
      return res.redirect('/admin');
    }

    return res.render('layouts/admin', buildDashboardModel(req.params.siteKey, req.adminSession));
  });

  return router;
}

module.exports = {
  createAdminDashboardRouter,
};
