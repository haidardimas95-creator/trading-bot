/**
 * Telegram Notifier
 * Send alerts via Telegram Bot
 */

const axios = require('axios');

// Environment variables (set di Vercel dashboard)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/**
 * Send message to Telegram
 */
async function sendMessage(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('[TELEGRAM] Not configured:', text.substring(0, 100));
    return false;
  }

  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: text,
      parse_mode: 'Markdown'
    });
    return true;
  } catch (error) {
    console.error('[TELEGRAM] Error:', error.message);
    return false;
  }
}

/**
 * Format number with emoji
 */
function formatMoney(amount) {
  if (Math.abs(amount) >= 1000) {
    return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return '$' + amount.toFixed(2);
}

/**
 * Send trade opened notification
 */
async function notifyTradeOpen(trade) {
  const message = `
*[TRADE OPENED]*

Symbol: *${trade.symbol}*
Entry Price: $${trade.entry_price}
Position: ${formatMoney(trade.position_size)}
Entry Date: ${new Date(trade.entry_date).toLocaleString()}

__{Date().toLocaleString()}__
`;
  return sendMessage(message);
}

/**
 * Send trade closed notification
 */
async function notifyTradeClose(trade) {
  const emoji = trade.pnl_pct >= 0 ? 'GREEN' : 'RED';
  const sign = trade.pnl_pct >= 0 ? '+' : '';

  const message = `
*[TRADE CLOSED - ${emoji}]*

Symbol: *${trade.symbol}*
Entry: $${trade.entry_price}
Exit: $${trade.exit_price}
P/L: *${sign}${trade.pnl_pct.toFixed(2)}%* (${formatMoney(trade.pnl_usd)})
Exit Type: ${trade.exit_type}
Hold: ${trade.bars_held || 0} bars

__{Date().toLocaleString()}__
`;
  return sendMessage(message);
}

/**
 * Send signal notification
 */
async function notifySignal(coin) {
  const message = `
*[ENTRY SIGNAL]*

Symbol: *${coin.symbol}*
Price: $${coin.price}
HHV20: $${coin.hhv20}

_${coin.name}_

__{Date().toLocaleString()}__
`;
  return sendMessage(message);
}

/**
 * Send equity update
 */
async function notifyEquityUpdate(equity) {
  const sign = equity.total_pnl >= 0 ? '+' : '';

  const message = `
*[EQUITY UPDATE]*

Total Equity: ${formatMoney(equity.total_equity)}
Total P/L: ${sign}${formatMoney(equity.total_pnl)} (${sign}${(equity.total_pnl / equity.initial_capital * 100).toFixed(2)}%)
Open Positions: ${equity.open_positions}
Closed Trades: ${equity.closed_positions}

__{Date().toLocaleString()}__
`;
  return sendMessage(message);
}

/**
 * Send bot started notification
 */
async function notifyStart() {
  const message = `
*[BOT STARTED]*

Strategy: OnAldhi_pf3_mean5
Mode: DRY_RUN
Platform: Vercel Serverless

Bot is now scanning for signals...

__{Date().toLocaleString()}__
`;
  return sendMessage(message);
}

/**
 * Send scan summary
 */
async function notifyScanSummary(stats) {
  const message = `
*[SCAN SUMMARY]*

Coins Scanned: ${stats.coins_scanned}
Signals Found: ${stats.signals_found}
Trades Opened: ${stats.trades_opened}
Trades Closed: ${stats.trades_closed}
Open Positions: ${stats.open_positions}

__{Date().toLocaleString()}__
`;
  return sendMessage(message);
}

/**
 * Send error notification
 */
async function notifyError(error, context) {
  const message = `
*[ERROR]*

Context: ${context}
Error: ${error.message || error}

__{Date().toLocaleString()}__
`;
  return sendMessage(message);
}

module.exports = {
  sendMessage,
  notifyTradeOpen,
  notifyTradeClose,
  notifySignal,
  notifyEquityUpdate,
  notifyStart,
  notifyScanSummary,
  notifyError
};
