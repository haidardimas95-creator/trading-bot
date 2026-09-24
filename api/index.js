/**
 * API: /api/index
 * Main entry point
 */

const notifier = require('../lib/notifier');
const db = require('../lib/database');

module.exports = async (req, res) => {
  // Initialize
  await db.initDatabase();

  // Send startup notification (sometimes)
  if (Math.random() < 0.1) { // 10% chance
    await notifier.notifyStart();
  }

  res.json({
    name: 'OnAldhi_pf3_mean5 Trading Bot',
    version: '1.0.0',
    platform: 'Vercel Serverless',
    status: 'running',
    endpoints: {
      scan: '/api/scan',
      'check-exits': '/api/check-exits',
      health: '/api/health'
    },
    timestamp: new Date().toISOString()
  });
};
