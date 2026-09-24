/**
 * CoinGecko API Client
 * Free API for price data
 */

const axios = require('axios');

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// Rate limiting
let lastRequestTime = 0;
const RATE_LIMIT_DELAY = 1500; // 1.5 seconds between requests

async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_DELAY) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - elapsed));
  }
  lastRequestTime = Date.now();
}

/**
 * Search for coins by keyword
 */
async function searchCoins(query) {
  await rateLimit();

  try {
    const response = await axios.get(`${COINGECKO_API}/search`, {
      params: { query }
    });

    return response.data.coins || [];
  } catch (error) {
    console.error('[CoinGecko] Search error:', error.message);
    return [];
  }
}

/**
 * Get coin's market data
 */
async function getCoinMarket(coinId) {
  await rateLimit();

  try {
    const response = await axios.get(`${COINGECKO_API}/coins/${coinId}`, {
      params: {
        localization: false,
        tickers: false,
        market_data: true,
        community_data: false,
        developer_data: false,
        sparkline: false
      }
    });

    return response.data;
  } catch (error) {
    console.error('[CoinGecko] Market error:', error.message);
    return null;
  }
}

/**
 * Get price history (market chart)
 */
async function getPriceHistory(coinId, days = 7, interval = 'hourly') {
  await rateLimit();

  try {
    const response = await axios.get(`${COINGECKO_API}/coins/${coinId}/market_chart`, {
      params: {
        vs_currency: 'usd',
        days: days,
        interval: days <= 1 ? 'hourly' : interval
      }
    });

    const prices = response.data.prices || [];

    // Convert to OHLC format
    if (prices.length === 0) return [];

    const ohlc = [];

    if (response.data.prices && response.data.prices.length > 0) {
      // Aggregate by hour
      const hourlyData = {};

      for (const [timestamp, price] of response.data.prices) {
        const date = new Date(timestamp);
        const hourKey = date.toISOString().substring(0, 13) + ':00';

        if (!hourlyData[hourKey]) {
          hourlyData[hourKey] = {
            date: hourKey,
            open: price,
            high: price,
            low: price,
            close: price
          };
        } else {
          hourlyData[hourKey].high = Math.max(hourlyData[hourKey].high, price);
          hourlyData[hourKey].low = Math.min(hourlyData[hourKey].low, price);
          hourlyData[hourKey].close = price;
        }
      }

      // Sort by date
      const sortedKeys = Object.keys(hourlyData).sort();
      for (const key of sortedKeys) {
        ohlc.push(hourlyData[key]);
      }
    }

    return ohlc;
  } catch (error) {
    console.error('[CoinGecko] Price history error:', error.message);
    return [];
  }
}

/**
 * Get current price for a coin
 */
async function getPrice(coinId) {
  await rateLimit();

  try {
    const response = await axios.get(`${COINGECKO_API}/simple/price`, {
      params: {
        ids: coinId,
        vs_currencies: 'usd'
      }
    });

    return response.data[coinId]?.usd || null;
  } catch (error) {
    console.error('[CoinGecko] Price error:', error.message);
    return null;
  }
}

/**
 * Get top coins by market cap
 */
async function getTopCoins(limit = 100) {
  await rateLimit();

  try {
    const response = await axios.get(`${COINGECKO_API}/coins/markets`, {
      params: {
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: limit,
        page: 1,
        sparkline: false
      }
    });

    return response.data || [];
  } catch (error) {
    console.error('[CoinGecko] Top coins error:', error.message);
    return [];
  }
}

/**
 * Get meme coin list
 */
async function getMemeCoins() {
  // Top meme coins to scan
  const MEME_KEYWORDS = [
    'pepe', 'dogecoin', 'shiba-inu', 'bonk', 'floki',
    'dogwifcoin', 'popcat', 'brett', 'fwog', 'pnut',
    'mog', 'cat-in-a-dogs-world', 'book-of-meme', 'goatseus-maximus'
  ];

  const coins = [];
  const seen = new Set();

  for (const keyword of MEME_KEYWORDS) {
    const results = await searchCoins(keyword);

    for (const coin of results.slice(0, 3)) {
      if (!seen.has(coin.id)) {
        seen.add(coin.id);
        coins.push({
          id: coin.id,
          symbol: coin.symbol?.toUpperCase(),
          name: coin.name,
          thumb: coin.thumb,
          market_cap_rank: coin.market_cap_rank
        });
      }
    }
  }

  return coins;
}

module.exports = {
  searchCoins,
  getCoinMarket,
  getPriceHistory,
  getPrice,
  getTopCoins,
  getMemeCoins
};
