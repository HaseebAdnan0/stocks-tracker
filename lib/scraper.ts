/**
 * Web scraper module for PSX (Pakistan Stock Exchange) data.
 *
 * Data sources:
 * - PSX Data Portal (dps.psx.com.pk) - Bulk market data (5-min delay but reliable)
 * - PSX Terminal API (psxterminal.com) - Real-time single stock data (15-sec updates)
 *
 * Strategy:
 * - Use PSX Data Portal for market watch (all stocks at once)
 * - Use PSX Terminal for individual stock details, EOD history, fundamentals
 */

import * as cheerio from 'cheerio';
import { USER_AGENT } from './config';

// Types for market data
export interface MarketWatchStock {
  symbol: string;
  name: string;
  ldcp: number;
  open: number;
  high: number;
  low: number;
  current: number;
  change: number;
  change_percent: number;
  volume: number;
}

export interface EODRecord {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Fundamentals {
  eps: number | null;
  pe_ratio: number | null;
  book_value: number | null;
  market_cap: number | null;
  dividend_yield: number | null;
  sector: string | null;
}

export interface DividendRecord {
  announcement_date: string;
  type: string;
  amount: number;
}

// API endpoints
const PSX_TERMINAL_API = 'https://psxterminal.com/api';
const PSX_DATA_PORTAL = 'https://dps.psx.com.pk';

// HTTP headers
const HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'application/json, text/html, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Interface for PSX Terminal responses
interface TickResponse {
  success: boolean;
  data: {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    high: number;
    low: number;
    ldcp?: number;
    open?: number;
    timestamp: number;
  };
}

interface KlinesResponse {
  success: boolean;
  data: Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
}

interface FundamentalsResponse {
  success: boolean;
  data: {
    eps?: number;
    peRatio?: number;
    bookValue?: number;
    marketCap?: number;
    dividendYield?: number;
    sector?: string;
  };
}

interface DividendsResponse {
  success: boolean;
  data: Array<{
    announceDate?: string;
    exDate?: string;
    dividendType?: string;
    amount?: number;
    percentage?: number;
  }>;
}

/**
 * Fetch live market watch data from PSX Data Portal.
 * Returns all stocks at once (no rate limiting issues).
 *
 * Table columns (0-indexed):
 * 0: SYMBOL (with link containing data-title for company name)
 * 1: SECTOR
 * 2: LISTED IN
 * 3: LDCP
 * 4: OPEN
 * 5: HIGH
 * 6: LOW
 * 7: CURRENT
 * 8: CHANGE (with icon)
 * 9: CHANGE % (with icon and %)
 * 10: VOLUME
 */
export async function fetchMarketWatch(): Promise<MarketWatchStock[] | null> {
  try {
    const response = await fetch(`${PSX_DATA_PORTAL}/market-watch`, {
      headers: {
        ...HEADERS,
        Accept: 'text/html',
      },
    });

    if (!response.ok) {
      console.error(`Market watch fetch failed: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const stocks: MarketWatchStock[] = [];

    // Parse the market watch table
    $('table.tbl tbody tr').each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length >= 11) {
        // Symbol is in a link inside the first cell
        const symbolLink = $(cells[0]).find('a.tbl__symbol');
        const symbol = symbolLink.find('strong').text().trim() || symbolLink.text().trim();
        // Company name is in the data-title attribute
        const name = symbolLink.attr('data-title') || symbol;

        // Parse numeric values from data-order attributes (cleaner) or text
        const ldcp = parseFloat($(cells[3]).attr('data-order') || $(cells[3]).text().replace(/,/g, '')) || 0;
        const open = parseFloat($(cells[4]).attr('data-order') || $(cells[4]).text().replace(/,/g, '')) || 0;
        const high = parseFloat($(cells[5]).attr('data-order') || $(cells[5]).text().replace(/,/g, '')) || 0;
        const low = parseFloat($(cells[6]).attr('data-order') || $(cells[6]).text().replace(/,/g, '')) || 0;
        const current = parseFloat($(cells[7]).attr('data-order') || $(cells[7]).text().replace(/,/g, '')) || 0;
        const change = parseFloat($(cells[8]).attr('data-order') || $(cells[8]).text().replace(/[^0-9.-]/g, '')) || 0;
        const change_percent = parseFloat($(cells[9]).attr('data-order') || $(cells[9]).text().replace(/[^0-9.-]/g, '')) || 0;
        const volume = parseInt($(cells[10]).attr('data-order') || $(cells[10]).text().replace(/,/g, ''), 10) || 0;

        if (symbol) {
          stocks.push({
            symbol,
            name,
            ldcp,
            open,
            high,
            low,
            current,
            change,
            change_percent,
            volume,
          });
        }
      }
    });

    return stocks.length > 0 ? stocks : null;
  } catch (error) {
    console.error('Error fetching market watch:', error);
    return null;
  }
}

/**
 * Fetch real-time stock data from PSX Terminal (single stock, no rate limit issues).
 * Use this for individual stock detail pages that need faster updates.
 */
export async function fetchRealTimeStock(symbol: string): Promise<MarketWatchStock | null> {
  try {
    const response = await fetch(`${PSX_TERMINAL_API}/ticks/REG/${encodeURIComponent(symbol.toUpperCase())}`, {
      headers: HEADERS,
    });

    if (!response.ok) {
      console.error(`Real-time fetch failed for ${symbol}: ${response.status}`);
      return null;
    }

    const data: TickResponse = await response.json();
    if (!data.success || !data.data) {
      return null;
    }

    const tick = data.data;
    const ldcp = tick.ldcp ?? (tick.price - tick.change);

    return {
      symbol: tick.symbol,
      name: tick.symbol, // PSX Terminal doesn't return company name in tick endpoint
      ldcp,
      open: tick.open ?? ldcp,
      high: tick.high,
      low: tick.low,
      current: tick.price,
      change: tick.change,
      change_percent: tick.changePercent * 100,
      volume: tick.volume,
    };
  } catch (error) {
    console.error(`Error fetching real-time stock ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetch end-of-day historical data from PSX Terminal.
 */
export async function fetchEodHistory(symbol: string, days: number = 365): Promise<EODRecord[] | null> {
  try {
    const url = `${PSX_TERMINAL_API}/klines/${encodeURIComponent(symbol.toUpperCase())}/1d?limit=${days}`;
    const response = await fetch(url, { headers: HEADERS });

    if (!response.ok) {
      console.error(`EOD history fetch failed for ${symbol}: ${response.status}`);
      return null;
    }

    const data: KlinesResponse = await response.json();

    if (!data.success || !Array.isArray(data.data)) {
      console.error(`EOD history response for ${symbol} is invalid`);
      return null;
    }

    return data.data
      .map((item) => ({
        date: new Date(item.timestamp).toISOString().split('T')[0],
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error(`Error fetching EOD history for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetch fundamental data from PSX Terminal.
 */
export async function fetchFundamentals(symbol: string): Promise<Fundamentals | null> {
  try {
    const url = `${PSX_TERMINAL_API}/fundamentals/${encodeURIComponent(symbol.toUpperCase())}`;
    const response = await fetch(url, { headers: HEADERS });

    if (!response.ok) {
      console.error(`Fundamentals fetch failed for ${symbol}: ${response.status}`);
      return null;
    }

    const data: FundamentalsResponse = await response.json();

    if (!data.success || !data.data) {
      console.error(`Fundamentals response for ${symbol} is invalid`);
      return null;
    }

    const f = data.data;

    return {
      eps: f.eps ?? null,
      pe_ratio: f.peRatio ?? null,
      book_value: f.bookValue ?? null,
      market_cap: f.marketCap ?? null,
      dividend_yield: f.dividendYield ?? null,
      sector: f.sector ?? null,
    };
  } catch (error) {
    console.error(`Error fetching fundamentals for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetch dividend history from PSX Terminal.
 */
export async function fetchDividendHistory(symbol: string): Promise<DividendRecord[] | null> {
  try {
    const url = `${PSX_TERMINAL_API}/dividends/${encodeURIComponent(symbol.toUpperCase())}`;
    const response = await fetch(url, { headers: HEADERS });

    if (!response.ok) {
      console.error(`Dividend history fetch failed for ${symbol}: ${response.status}`);
      return null;
    }

    const data: DividendsResponse = await response.json();

    if (!data.success || !Array.isArray(data.data)) {
      console.error(`Dividend history response for ${symbol} is invalid`);
      return null;
    }

    return data.data.map((item) => ({
      announcement_date: item.announceDate || item.exDate || '',
      type: item.dividendType || 'Cash',
      amount: item.amount || item.percentage || 0,
    }));
  } catch (error) {
    console.error(`Error fetching dividend history for ${symbol}:`, error);
    return null;
  }
}
