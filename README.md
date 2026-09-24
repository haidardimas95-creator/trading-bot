# OnAldhi_pf3_mean5 Trading Bot - Vercel Deployment

## Overview

Trading bot untuk meme coin menggunakan strategi HHV20 Breakout dengan Trailing Stop.
Deployed di Vercel (serverless) dengan Supabase sebagai database.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      VERCEL                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐      ┌─────────────┐      ┌────────────┐ │
│  │  Vercel     │ ───► │  API        │ ───► │  Supabase  │ │
│  │  Cron       │      │  Functions  │      │  Database  │ │
│  │  /15 min    │      │  Node.js    │      │  (free)    │ │
│  └─────────────┘      └─────────────┘      └────────────┘ │
│        │                    │                    │         │
│        └────────────────────┼────────────────────┘         │
│                             │                              │
│                             ▼                              │
│                      ┌─────────────┐                       │
│                      │  Telegram   │                       │
│                      │  Notifier  │                       │
│                      └─────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

## Features

- **Strategy**: OnAldhi_pf3_mean5 (HHV20 Breakout + Trailing Stop)
- **Data Source**: CoinGecko API (free tier)
- **Database**: Supabase (free tier, PostgreSQL)
- **Notifications**: Telegram Bot
- **Cron Jobs**: Scan setiap 15 menit, check exits setiap 5 menit

## Deployment Steps

### 1. Buat Akun

1. [Vercel](https://vercel.com) - untuk hosting
2. [Supabase](https://supabase.com) - untuk database (free tier)
3. [Telegram Bot](https://t.me/BotFather) - untuk notifications

### 2. Setup Supabase

1. Buat project baru di Supabase
2. Dapatkan URL dan anon key dari Settings > API
3. Buat database dengan schema berikut (via SQL Editor):

```sql
CREATE TABLE trades (
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

CREATE TABLE equity_history (
  id SERIAL PRIMARY KEY,
  total_equity DECIMAL,
  open_positions INTEGER,
  closed_positions INTEGER,
  total_pnl DECIMAL,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE TABLE config (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE,
  value JSONB,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE scan_history (
  id SERIAL PRIMARY KEY,
  scanned_at TIMESTAMP DEFAULT NOW(),
  coins_scanned INTEGER,
  signals_found INTEGER,
  trades_opened INTEGER,
  trades_closed INTEGER
);
```

### 3. Setup Telegram Bot

1. Buka @BotFather di Telegram
2. Ketik `/newbot`
3. Ikuti instruksi, simpan bot token
4. Buka bot baru Anda, kirim `/start`
5. Dapatkan Chat ID dari @userinfobot

### 4. Deploy ke Vercel

```bash
# Clone atau download project ini

# Install dependencies
npm install

# Login ke Vercel
npx vercel login

# Deploy
npx vercel --prod
```

### 5. Set Environment Variables

Di Vercel Dashboard > Settings > Environment Variables:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
TELEGRAM_BOT_TOKEN=123456:ABCdefGhIJKlmNoPQRsTUVwxyZ
TELEGRAM_CHAT_ID=123456789
```

### 6. Verifikasi Deployment

1. Buka `https://your-project.vercel.app/api/health`
2. Harus return JSON dengan status "ok"
3. Cek Telegram - harus ada pesan "BOT STARTED"

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check & stats |
| `/api/scan` | GET | Scan for signals (cron) |
| `/api/check-exits` | GET | Check exit signals (cron) |
| `/api/index` | GET | Info & start notification |

## Cron Schedule

| Endpoint | Schedule | Description |
|----------|----------|-------------|
| `/api/scan` | `*/15 * * * *` | Setiap 15 menit |
| `/api/check-exits` | `*/5 * * * *` | Setiap 5 menit |

## Strategy Parameters

```javascript
{
  hhvPeriod: 20,        // Highest High Period
  trailPct: 8,         // Trailing Stop %
  trailStart: 5,       // Bars before TS activates
  givebackPct: 8,      // Max profit giveback
  maxHoldBars: 168     // Max hold (168 hours = 1 week)
}
```

## Trading Parameters

```javascript
{
  commissionPct: 0.25,   // Commission %
  slippagePct: 0.50,     // Slippage %
  positionSizePct: 10,   // % of capital per trade
  maxOpenPositions: 5     // Max simultaneous positions
}
```

## Limitations

- **Serverless**: Tidak 24/7 aktif, dipanggil via cron
- **Cold Start**: ~1-5 detik untuk function启动
- **Rate Limit**: CoinGecko free tier = 10-30 calls/minute
- **Cron Limit**: Vercel free tier = 10 cron runs/day

## Cost

| Service | Free Tier | Paid |
|---------|-----------|------|
| Vercel | 10 cron/day, 100GB bandwidth | From $20/mo |
| Supabase | 500MB database, 1GB storage | From $25/mo |
| Telegram | Free | Free |
| CoinGecko | Free (limited) | From $79/mo |

## Troubleshooting

### Bot tidak jalan
1. Cek `/api/health` endpoint
2. Cek Vercel function logs
3. Verify environment variables

### Tidak ada signals
1. Market mungkin sideways
2. Cek CoinGecko rate limits
3. Tambah more meme coins di `lib/coingecko.js`

### Telegram tidak dapat pesan
1. Verify bot token & chat ID
2. Pastikan bot sudah di-start oleh user
3. Cek Vercel logs untuk error

## License

MIT
