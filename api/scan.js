/**
 * API: /api/scan
 * Main scanning endpoint - triggered by Vercel Cron
 *
 * Runs every 15 minutes via vercel.json cron config
 */

const coinGecko = require('../lib/coingecko');
const strategy = require('../lib/strategy');
const db = require('../lib/database');
const notifier = require('../lib/notifier');

module.exports = async (req, res) => {
  const startTime = Date.now();

  console.log('[SCAN] Starting scan at', new Date().toISOString());

  try {
    // Initialize database
    await db.initDatabase();

    // Scan for meme coins
    const memeCoins = await coinGecko.getMemeCoins();
    console.log('[SCAN] Found', memeCoins.length, 'meme coins');

    const signals = [];
    const trades = {
      opened: 0,
      closed: 0
    };

    // Get current open positions
    const openPositions = await db.getOpenTrades();
    console.log('[SCAN] Open positions:', openPositions.length);

    // Calculate position size
    const initialCapital = await db.getConfig('initial_capital') || 10000;
    const positionSizePct = await db.getConfig('position_size_pct') || 10;
    const maxPositions = await db.getConfig('max_open_positions') || 5;
    const positionSize = initialCapital * (positionSizePct / 100);

    // Scan each coin for entry signals
    for (const coin of memeCoins) {
      try {
        // Get price history (7 days hourly)
        const history = await coinGecko.getPriceHistory(coin.id, 7, 'hourly');

        if (history.length < strategy.STRATEGY.hhvPeriod + 1) {
          continue;
        }

        // Add index to each candle
        const data = history.map((c, i) => ({ ...c, index: i }));

        // Check for entry signals
        const entrySignals = strategy.checkEntrySignal(data);

        for (const signal of entrySignals.slice(-1)) { // Only take most recent
          // Check if already have position in this coin
          const existingPosition = openPositions.find(p =>
            p.symbol === coin.symbol || p.coin_id === coin.id
          );

          if (existingPosition) {
            continue; // Already in position
          }

          // Check if can open new position
          if (openPositions.length + signals.length >= maxPositions) {
            break;
          }

          // Get current price
          const currentPrice = await coinGecko.getPrice(coin.id);

          if (!currentPrice) continue;

          // Create trade
          const trade = strategy.createTrade({
            ...signal,
            symbol: coin.symbol,
            coin_id: coin.id,
            name: coin.name
          }, positionSize, currentPrice);

          // Save to database
          await db.addTrade(trade);

          // Send notification
          await notifier.notifyTradeOpen(trade);

          signals.push(trade);
          trades.opened++;

          console.log('[SCAN] Entry signal:', coin.symbol, 'at', currentPrice);
        }

      } catch (error) {
        console.error('[SCAN] Error scanning', coin.symbol, error.message);
      }
    }

    // Check for exit signals on open positions
    for (const position of openPositions) {
      try {
        // Get current price data
        const history = await coinGecko.getPriceHistory(position.coin_id, 1, 'hourly');

        if (history.length === 0) continue;

        const currentData = {
          ...history[history.length - 1],
          index: position.entry_index + position.bars_held
        };

        // Check exit signal
        const exitSignal = strategy.checkExitSignal(position, currentData);

        if (exitSignal) {
          // Close the trade
          const closeData = {
            exit_price: exitSignal.exit_price,
            pnl_pct: exitSignal.pnl_pct,
            pnl_usd: position.position_size * (exitSignal.pnl_pct / 100),
            exit_type: exitSignal.type,
            bars_held: exitSignal.bars_held
          };

          await db.closeTrade(position.id, closeData);

          // Send notification
          await notifier.notifyTradeClose({
            ...position,
            ...closeData
          });

          trades.closed++;

          console.log('[SCAN] Exit signal:', position.symbol, exitSignal.type, exitSignal.pnl_pct);
        }

      } catch (error) {
        console.error('[SCAN] Error checking exit', position.symbol, error.message);
      }
    }

    // Calculate equity
    const allTrades = await db.getAllTrades();
    const closedTrades = allTrades.filter(t => t.status === 'CLOSED');
    const currentOpenPositions = await db.getOpenTrades();

    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl_usd || 0), 0);
    const openPnl = currentOpenPositions.reduce((sum, t) => {
      // Estimate current P/L
      const currentPrice = t.position_amount * 1; // Would need actual price
      return sum + (currentPrice - t.position_size);
    }, 0);

    const totalEquity = initialCapital + totalPnl + openPnl;

    // Record equity
    await db.recordEquity({
      total_equity: totalEquity,
      total_pnl: totalPnl,
      initial_capital: initialCapital,
      open_positions: currentOpenPositions.length,
      closed_positions: closedTrades.length
    });

    // Log scan
    await db.logScan({
      coins_scanned: memeCoins.length,
      signals_found: signals.length,
      trades_opened: trades.opened,
      trades_closed: trades.closed,
      open_positions: currentOpenPositions.length
    });

    const duration = Date.now() - startTime;

    console.log('[SCAN] Complete in', duration, 'ms');
    console.log('[SCAN] Signals:', signals.length, 'Trades opened:', trades.opened, 'Trades closed:', trades.closed);

    // Send scan summary every hour (every 4th run approximately)
    if (Math.random() < 0.25) {
      await notifier.notifyScanSummary({
        coins_scanned: memeCoins.length,
        signals_found: signals.length,
        trades_opened: trades.opened,
        trades_closed: trades.closed,
        open_positions: currentOpenPositions.length
      });
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      coins_scanned: memeCoins.length,
      signals_found: signals.length,
      trades: trades,
      open_positions: currentOpenPositions.length,
      total_equity: totalEquity,
      total_pnl: totalPnl
    });

  } catch (error) {
    console.error('[SCAN] Error:', error);

    await notifier.notifyError(error, 'scan');

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
