/**
 * API: /api/check-exits
 * Check for exit signals on open positions
 *
 * Runs every 5 minutes to monitor trailing stops
 */

const coinGecko = require('../lib/coingecko');
const strategy = require('../lib/strategy');
const db = require('../lib/database');
const notifier = require('../lib/notifier');

module.exports = async (req, res) => {
  const startTime = Date.now();

  console.log('[EXIT CHECK] Starting at', new Date().toISOString());

  try {
    // Initialize database
    await db.initDatabase();

    // Get open positions
    const openPositions = await db.getOpenTrades();

    if (openPositions.length === 0) {
      console.log('[EXIT CHECK] No open positions');
      return res.json({
        success: true,
        message: 'No open positions',
        checked: 0,
        exits: 0
      });
    }

    console.log('[EXIT CHECK] Checking', openPositions.length, 'positions');

    const exits = [];

    for (const position of openPositions) {
      try {
        // Get latest price
        const price = await coinGecko.getPrice(position.coin_id);

        if (!price) continue;

        // Get recent price history for high/low
        const history = await coinGecko.getPriceHistory(position.coin_id, 1, 'hourly');

        if (history.length === 0) continue;

        const currentData = {
          high: Math.max(...history.map(h => h.high)),
          low: Math.min(...history.map(h => h.low)),
          close: price,
          index: position.entry_index + position.bars_held
        };

        // Update position with latest values
        if (currentData.high > (position.highest_high || 0)) {
          position.highest_high = currentData.high;
        }

        const currentProfitPct = ((currentData.close - position.entry_price) / position.entry_price) * 100;
        if (currentProfitPct > (position.peak_profit || 0)) {
          position.peak_profit = currentProfitPct;
        }

        // Update trailing stop
        const barsHeld = currentData.index - position.entry_index;

        if (barsHeld >= strategy.STRATEGY.trailStart) {
          if (position.trailing_stop === 0) {
            position.trailing_stop = position.highest_high * (1 - strategy.STRATEGY.trailPct / 100);
          } else {
            const newTrail = position.highest_high * (1 - strategy.STRATEGY.trailPct / 100);
            if (newTrail > position.trailing_stop) {
              position.trailing_stop = newTrail;
            }
          }

          // Check if TS hit
          if (currentData.low <= position.trailing_stop) {
            const giveback = position.peak_profit - currentProfitPct;

            if (position.peak_profit > strategy.STRATEGY.givebackPct && giveback >= strategy.STRATEGY.givebackPct) {
              // Exit via TS with giveback
              const exitPrice = position.trailing_stop * (1 - strategy.TRADING.slippagePct / 100);

              const closeData = {
                exit_price: exitPrice,
                pnl_pct: ((exitPrice - position.entry_price) / position.entry_price * 100),
                pnl_usd: position.position_size * ((exitPrice - position.entry_price) / position.entry_price),
                exit_type: 'TS',
                bars_held: barsHeld,
                highest_high: position.highest_high,
                trailing_stop: position.trailing_stop,
                peak_profit: position.peak_profit
              };

              await db.closeTrade(position.id, closeData);

              exits.push({
                symbol: position.symbol,
                type: 'TS',
                pnl_pct: closeData.pnl_pct,
                bars_held: barsHeld
              });

              await notifier.notifyTradeClose({
                ...position,
                ...closeData
              });

              console.log('[EXIT CHECK] TS exit:', position.symbol, closeData.pnl_pct);
            }
          }
        }

        // Check max hold
        if (barsHeld >= strategy.STRATEGY.maxHoldBars) {
          const exitPrice = currentData.close * (1 - strategy.TRADING.slippagePct / 100);

          const closeData = {
            exit_price: exitPrice,
            pnl_pct: ((exitPrice - position.entry_price) / position.entry_price * 100),
            pnl_usd: position.position_size * ((exitPrice - position.entry_price) / position.entry_price),
            exit_type: 'MAX',
            bars_held: barsHeld
          };

          await db.closeTrade(position.id, closeData);

          exits.push({
            symbol: position.symbol,
            type: 'MAX',
            pnl_pct: closeData.pnl_pct,
            bars_held: barsHeld
          });

          await notifier.notifyTradeClose({
            ...position,
            ...closeData
          });

          console.log('[EXIT CHECK] MAX hold exit:', position.symbol);
        }

        // Update position with latest values
        await db.updateTrade(position.id, {
          highest_high: position.highest_high,
          trailing_stop: position.trailing_stop,
          peak_profit: position.peak_profit,
          bars_held: barsHeld
        });

      } catch (error) {
        console.error('[EXIT CHECK] Error checking', position.symbol, error.message);
      }
    }

    const duration = Date.now() - startTime;

    console.log('[EXIT CHECK] Complete in', duration, 'ms, exits:', exits.length);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      checked: openPositions.length,
      exits: exits.length,
      exit_details: exits
    });

  } catch (error) {
    console.error('[EXIT CHECK] Error:', error);

    await notifier.notifyError(error, 'check-exits');

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
