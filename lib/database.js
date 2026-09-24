/**
 * Supabase Database Client
 * Persistent storage for trading bot
 */

const { createClient } = require('@supabase/supabase-js');

// Environment variables (set di Vercel dashboard)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

/**
 * Initialize database schema
 */
async function initDatabase() {
  if (!supabase) {
    console.log('[DB] Supabase not configured, using in-memory store');
    return false;
  }

  // Create tables if not exist
  const { error } = await supabase.rpc('exec', {
    sql: `
      CREATE TABLE IF NOT EXISTS trades (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        symbol TEXT NOT NULL,
        coin_id TEXT,
        entry_price DECIMAL,
        exit_price DECIMAL,
        position_size DECIMAL,
        entry_date TIMESTAMP,
        exit_date TIMESTAMP,
        pnl_pct DECIMAL,
        pnl_usd DECIMAL,
        exit_type TEXT,
        status TEXT DEFAULT 'OPEN',
        trailing_stop DECIMAL,
        highest_high DECIMAL,
        peak_profit DECIMAL,
        bars_held INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS equity_history (
        id SERIAL PRIMARY KEY,
        total_equity DECIMAL,
        open_positions INTEGER,
        closed_positions INTEGER,
        total_pnl DECIMAL,
        timestamp TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS config (
        id SERIAL PRIMARY KEY,
        key TEXT UNIQUE,
        value JSONB,
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS scan_history (
        id SERIAL PRIMARY KEY,
        scanned_at TIMESTAMP DEFAULT NOW(),
        coins_scanned INTEGER,
        signals_found INTEGER,
        trades_opened INTEGER,
        trades_closed INTEGER
      );
    `
  }).catch(() => {
    // RPC might not exist, ignore
  });

  return true;
}

// In-memory store (fallback if no Supabase)
const memoryStore = {
  trades: [],
  equity: [],
  config: {
    initial_capital: 10000,
    position_size_pct: 10,
    max_open_positions: 5
  }
};

/**
 * Get all open positions
 */
async function getOpenTrades() {
  if (supabase) {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('status', 'OPEN')
      .order('created_at', { ascending: false });

    if (!error) return data || [];
  }

  return memoryStore.trades.filter(t => t.status === 'OPEN');
}

/**
 * Get all trades
 */
async function getAllTrades(limit = 100) {
  if (supabase) {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!error) return data || [];
  }

  return memoryStore.trades.slice(0, limit);
}

/**
 * Add new trade
 */
async function addTrade(trade) {
  const tradeData = {
    ...trade,
    status: 'OPEN',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (supabase) {
    const { data, error } = await supabase
      .from('trades')
      .insert([tradeData])
      .select()
      .single();

    if (!error) return data;
  }

  memoryStore.trades.push(tradeData);
  return tradeData;
}

/**
 * Update trade
 */
async function updateTrade(tradeId, updates) {
  updates.updated_at = new Date().toISOString();

  if (supabase) {
    const { data, error } = await supabase
      .from('trades')
      .update(updates)
      .eq('id', tradeId)
      .select()
      .single();

    if (!error) return data;
  }

  const idx = memoryStore.trades.findIndex(t => t.id === tradeId);
  if (idx >= 0) {
    memoryStore.trades[idx] = { ...memoryStore.trades[idx], ...updates };
    return memoryStore.trades[idx];
  }

  return null;
}

/**
 * Close trade
 */
async function closeTrade(tradeId, exitData) {
  const updates = {
    status: 'CLOSED',
    exit_price: exitData.exit_price,
    exit_date: new Date().toISOString(),
    pnl_pct: exitData.pnl_pct,
    pnl_usd: exitData.pnl_usd,
    exit_type: exitData.exit_type,
    updated_at: new Date().toISOString()
  };

  return updateTrade(tradeId, updates);
}

/**
 * Record equity snapshot
 */
async function recordEquity(equityData) {
  const data = {
    ...equityData,
    timestamp: new Date().toISOString()
  };

  if (supabase) {
    await supabase
      .from('equity_history')
      .insert([data]);
  }

  memoryStore.equity.push(data);
  return data;
}

/**
 * Get config
 */
async function getConfig(key) {
  if (supabase) {
    const { data, error } = await supabase
      .from('config')
      .select('value')
      .eq('key', key)
      .single();

    if (!error && data) return data.value;
  }

  return memoryStore.config[key];
}

/**
 * Set config
 */
async function setConfig(key, value) {
  if (supabase) {
    await supabase
      .from('config')
      .upsert({ key, value, updated_at: new Date().toISOString() });
  }

  memoryStore.config[key] = value;
  return true;
}

/**
 * Log scan result
 */
async function logScan(stats) {
  const data = {
    ...stats,
    scanned_at: new Date().toISOString()
  };

  if (supabase) {
    await supabase
      .from('scan_history')
      .insert([data]);
  }

  return data;
}

module.exports = {
  initDatabase,
  getOpenTrades,
  getAllTrades,
  addTrade,
  updateTrade,
  closeTrade,
  recordEquity,
  getConfig,
  setConfig,
  logScan
};
