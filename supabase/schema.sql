-- Supabase Database Schema for OnAldhi Trading Bot
-- Run this in SQL Editor at https://app.supabase.com

-- ============================================
-- TRADES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  coin_id TEXT,
  coin_name TEXT,
  entry_price DECIMAL,
  exit_price DECIMAL,
  position_size DECIMAL,
  position_amount DECIMAL,
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

-- ============================================
-- EQUITY HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS equity_history (
  id SERIAL PRIMARY KEY,
  total_equity DECIMAL,
  open_positions INTEGER,
  closed_positions INTEGER,
  total_pnl DECIMAL,
  initial_capital DECIMAL,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- CONFIG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS config (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- SCAN HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS scan_history (
  id SERIAL PRIMARY KEY,
  scanned_at TIMESTAMP DEFAULT NOW(),
  coins_scanned INTEGER,
  signals_found INTEGER,
  trades_opened INTEGER,
  trades_closed INTEGER,
  open_positions INTEGER,
  duration_ms INTEGER
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_created ON trades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_equity_timestamp ON equity_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_scan_scanned ON scan_history(scanned_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE equity_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_history ENABLE ROW LEVEL SECURITY;

-- Allow public read/write (adjust for production)
CREATE POLICY "Allow all on trades" ON trades FOR ALL USING (true);
CREATE POLICY "Allow all on equity_history" ON equity_history FOR ALL USING (true);
CREATE POLICY "Allow all on config" ON config FOR ALL USING (true);
CREATE POLICY "Allow all on scan_history" ON scan_history FOR ALL USING (true);

-- ============================================
-- INSERT DEFAULT CONFIG
-- ============================================
INSERT INTO config (key, value) VALUES
  ('initial_capital', '10000'),
  ('position_size_pct', '10'),
  ('max_open_positions', '5'),
  ('commission_pct', '0.25'),
  ('slippage_pct', '0.50')
ON CONFLICT (key) DO NOTHING;
