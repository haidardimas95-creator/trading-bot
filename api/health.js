/**
 * API: /api/health
 * Health check endpoint
 */

const db = require('../lib/database');

module.exports = async (req, res) => {
  try {
    // Initialize database
    await db.initDatabase();

    // Get basic stats
    const openPositions = await db.getOpenTrades();
    const allTrades = await db.getAllTrades(10);
    const closedTrades = allTrades.filter(t => t.status === 'CLOSED');

    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl_usd || 0), 0);

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      platform: 'vercel',
      strategy: 'OnAldhi_pf3_mean5',
      stats: {
        open_positions: openPositions.length,
        total_trades: allTrades.length,
        closed_trades: closedTrades.length,
        total_pnl: totalPnl
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
};
