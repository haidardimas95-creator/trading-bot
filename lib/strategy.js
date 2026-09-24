/**
 * Strategy Engine - OnAldhi_pf3_mean5
 * HHV20 Breakout with Trailing Stop
 *
 * Logic based on original Python/JavaScript strategy
 */

// Strategy parameters
const STRATEGY = {
  name: 'OnAldhi_pf3_mean5',
  hhvPeriod: 20,
  trailPct: 8,
  trailStart: 5,
  givebackPct: 8,
  maxHoldBars: 168 // 168 hours = 1 week
};

// Trading parameters
const TRADING = {
  commissionPct: 0.25,
  slippagePct: 0.50,
  positionSizePct: 10,
  maxOpenPositions: 5,
  initialCapital: 10000
};

/**
 * Calculate Highest High for given period
 */
function calculateHHV(highs, period) {
  const result = [];
  for (let i = 0; i < highs.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let max = -Infinity;
      for (let j = 0; j < period; j++) {
        if (highs[i - j] > max) max = highs[i - j];
      }
      result.push(max);
    }
  }
  return result;
}

/**
 * Check for entry signals (High >= HHV20)
 */
function checkEntrySignal(data) {
  if (data.length < STRATEGY.hhvPeriod + 1) {
    return [];
  }

  const highs = data.map(d => d.high);
  const hhv = calculateHHV(highs, STRATEGY.hhvPeriod);

  const signals = [];

  for (let i = STRATEGY.hhvPeriod; i < data.length - 1; i++) {
    if (hhv[i] === null) continue;

    const currentHigh = highs[i];
    const currentClose = data[i].close;

    // ENTRY: High >= HHV20
    if (currentHigh >= hhv[i]) {
      signals.push({
        date: data[i].date,
        index: i,
        type: 'ENTRY',
        price: currentClose,
        high: currentHigh,
        hhv20: hhv[i],
        distancePct: ((currentHigh - hhv[i]) / hhv[i] * 100)
      });
    }
  }

  return signals;
}

/**
 * Check exit signal for a position
 */
function checkExitSignal(trade, currentData) {
  const entryIdx = trade.entry_index;
  const entryPrice = trade.entry_price;
  const currentPrice = currentData.close;

  let highestHigh = trade.highest_high || currentPrice;
  let trailingStop = trade.trailing_stop || 0;
  let peakProfit = trade.peak_profit || 0;

  // Update highest high
  if (currentData.high > highestHigh) {
    highestHigh = currentData.high;
  }

  // Calculate current profit
  const currentProfitPct = ((currentPrice - entryPrice) / entryPrice) * 100;
  if (currentProfitPct > peakProfit) {
    peakProfit = currentProfitPct;
  }

  const barsHeld = currentData.index - entryIdx;

  let exitSignal = null;

  // Update trailing stop after trail_start bars
  if (barsHeld >= STRATEGY.trailStart) {
    if (trailingStop === 0) {
      trailingStop = highestHigh * (1 - STRATEGY.trailPct / 100);
    } else {
      const newTrail = highestHigh * (1 - STRATEGY.trailPct / 100);
      if (newTrail > trailingStop) {
        trailingStop = newTrail;
      }
    }

    // Check trailing stop hit
    if (trailingStop > 0 && currentData.low <= trailingStop) {
      const giveback = peakProfit - currentProfitPct;

      if (peakProfit > STRATEGY.givebackPct && giveback >= STRATEGY.givebackPct) {
        // Exit via TS
        exitSignal = {
          type: 'TS',
          exit_price: trailingStop * (1 - TRADING.slippagePct / 100),
          pnl_pct: ((trailingStop * (1 - TRADING.slippagePct / 100) - entryPrice) / entryPrice * 100),
          bars_held: barsHeld,
          peak_profit: peakProfit
        };
      } else if (peakProfit <= STRATEGY.givebackPct) {
        // Exit via TS even without giveback
        exitSignal = {
          type: 'TS',
          exit_price: trailingStop * (1 - TRADING.slippagePct / 100),
          pnl_pct: ((trailingStop * (1 - TRADING.slippagePct / 100) - entryPrice) / entryPrice * 100),
          bars_held: barsHeld,
          peak_profit: peakProfit
        };
      }
    }
  }

  // Max hold check
  if (barsHeld >= STRATEGY.maxHoldBars && !exitSignal) {
    exitSignal = {
      type: 'MAX',
      exit_price: currentPrice * (1 - TRADING.slippagePct / 100),
      pnl_pct: ((currentPrice * (1 - TRADING.slippagePct / 100) - entryPrice) / entryPrice * 100),
      bars_held: barsHeld,
      peak_profit: peakProfit
    };
  }

  // Update trade with new values
  trade.highest_high = highestHigh;
  trade.trailing_stop = trailingStop;
  trade.peak_profit = peakProfit;
  trade.bars_held = barsHeld;

  return exitSignal;
}

/**
 * Create new trade from signal
 */
function createTrade(signal, positionSize, currentPrice) {
  const entryPrice = currentPrice * (1 + TRADING.slippagePct / 100);
  const positionAmount = positionSize / entryPrice;

  return {
    id: generateId(),
    symbol: signal.symbol || signal.coin_id,
    coin_id: signal.coin_id,
    coin_name: signal.name,
    entry_price: entryPrice,
    entry_date: new Date().toISOString(),
    entry_index: signal.index,
    position_size: positionSize,
    position_amount: positionAmount,
    highest_high: currentPrice,
    trailing_stop: 0,
    peak_profit: 0,
    bars_held: 0,
    status: 'OPEN'
  };
}

/**
 * Calculate P/L for closed trade
 */
function calculateTradePnL(trade) {
  const exitPrice = trade.exit_price;
  const entryPrice = trade.entry_price;
  const positionSize = trade.position_size;

  // Gross P/L
  const pnlPct = ((exitPrice - entryPrice) / entryPrice) * 100;
  const pnlUsd = positionSize * (exitPrice / entryPrice - 1);

  // Subtract fees
  const commissionEntry = positionSize * TRADING.commissionPct / 100;
  const commissionExit = positionSize * (exitPrice / entryPrice) * TRADING.commissionPct / 100;
  const slippageEntry = positionSize * TRADING.slippagePct / 100;
  const slippageExit = positionSize * (exitPrice / entryPrice) * TRADING.slippagePct / 100;

  const totalFees = commissionEntry + commissionExit + slippageEntry + slippageExit;
  const netPnlUsd = pnlUsd - totalFees;

  return {
    pnl_pct: pnlPct,
    pnl_usd: netPnlUsd,
    fees: totalFees,
    gross_pnl: pnlUsd
  };
}

/**
 * Generate unique ID
 */
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Get strategy status
 */
function getStrategyStatus() {
  return {
    ...STRATEGY,
    ...TRADING
  };
}

module.exports = {
  STRATEGY,
  TRADING,
  calculateHHV,
  checkEntrySignal,
  checkExitSignal,
  createTrade,
  calculateTradePnL,
  getStrategyStatus
};
