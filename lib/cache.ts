/**
 * Caching utilities for PSX data scraping.
 *
 * Provides a generic caching layer to minimize requests to PSX servers.
 * Returns cached data immediately for fast page loads, with background refresh.
 */

import { CACHE_DURATION } from './config';
import {
  getMarketDataCache,
  setMarketDataCache,
  getEODDataCache,
  setEODDataCache,
  getFundamentalsCache,
  setFundamentalsCache,
} from './db';
import {
  fetchMarketWatch,
  fetchEodHistory,
  fetchFundamentals,
  MarketWatchStock,
  EODRecord,
  Fundamentals,
} from './scraper';

// Response type for cached data
export interface CacheResponse<T> {
  data: T | null;
  fetched_at: string | null;
  is_stale: boolean;
}

/**
 * Check if a cache entry is still fresh.
 */
function isCacheFresh(fetchedAt: string, maxAgeSeconds: number): boolean {
  const cacheTime = new Date(fetchedAt).getTime();
  const now = Date.now();
  return now - cacheTime < maxAgeSeconds * 1000;
}

/**
 * Get market watch data with caching.
 */
export async function getCachedMarketWatch(): Promise<CacheResponse<MarketWatchStock[]>> {
  const cacheKey = 'market-watch';
  const maxAge = CACHE_DURATION.market_watch;

  // Try to get cached data
  const cached = getMarketDataCache(cacheKey);

  if (cached) {
    const isFresh = isCacheFresh(cached.fetched_at, maxAge);

    if (isFresh) {
      // Cache hit - data is fresh
      return {
        data: JSON.parse(cached.data),
        fetched_at: cached.fetched_at,
        is_stale: false,
      };
    }

    // Cache is stale - try to fetch fresh data, but return stale data if fetch fails
    const freshData = await fetchMarketWatch();

    if (freshData !== null) {
      // Successfully fetched fresh data - update cache
      setMarketDataCache(cacheKey, freshData);
      return {
        data: freshData,
        fetched_at: new Date().toISOString(),
        is_stale: false,
      };
    }

    // Fetch failed - return stale data
    return {
      data: JSON.parse(cached.data),
      fetched_at: cached.fetched_at,
      is_stale: true,
    };
  }

  // No cache - must fetch
  const data = await fetchMarketWatch();

  if (data !== null) {
    setMarketDataCache(cacheKey, data);
    return {
      data: data,
      fetched_at: new Date().toISOString(),
      is_stale: false,
    };
  }

  // No cache and fetch failed
  return {
    data: null,
    fetched_at: null,
    is_stale: false,
  };
}

/**
 * Get EOD history data with caching.
 */
export async function getCachedEodHistory(symbol: string): Promise<CacheResponse<EODRecord[]>> {
  const normalizedSymbol = symbol.toUpperCase();
  const maxAge = CACHE_DURATION.eod;

  // Try to get cached data
  const cached = getEODDataCache(normalizedSymbol);

  if (cached) {
    const isFresh = isCacheFresh(cached.fetched_at, maxAge);

    if (isFresh) {
      return {
        data: JSON.parse(cached.data),
        fetched_at: cached.fetched_at,
        is_stale: false,
      };
    }

    // Cache is stale - try to fetch fresh data
    const freshData = await fetchEodHistory(normalizedSymbol);

    if (freshData !== null) {
      setEODDataCache(normalizedSymbol, freshData);
      return {
        data: freshData,
        fetched_at: new Date().toISOString(),
        is_stale: false,
      };
    }

    // Fetch failed - return stale data
    return {
      data: JSON.parse(cached.data),
      fetched_at: cached.fetched_at,
      is_stale: true,
    };
  }

  // No cache - must fetch
  const data = await fetchEodHistory(normalizedSymbol);

  if (data !== null) {
    setEODDataCache(normalizedSymbol, data);
    return {
      data: data,
      fetched_at: new Date().toISOString(),
      is_stale: false,
    };
  }

  return {
    data: null,
    fetched_at: null,
    is_stale: false,
  };
}

/**
 * Get fundamentals data with caching.
 */
export async function getCachedFundamentals(symbol: string): Promise<CacheResponse<Fundamentals>> {
  const normalizedSymbol = symbol.toUpperCase();
  const maxAge = CACHE_DURATION.fundamentals;

  // Try to get cached data
  const cached = getFundamentalsCache(normalizedSymbol);

  if (cached) {
    const isFresh = isCacheFresh(cached.fetched_at, maxAge);

    if (isFresh) {
      return {
        data: JSON.parse(cached.data),
        fetched_at: cached.fetched_at,
        is_stale: false,
      };
    }

    // Cache is stale - try to fetch fresh data
    const freshData = await fetchFundamentals(normalizedSymbol);

    if (freshData !== null) {
      setFundamentalsCache(normalizedSymbol, freshData);
      return {
        data: freshData,
        fetched_at: new Date().toISOString(),
        is_stale: false,
      };
    }

    // Fetch failed - return stale data
    return {
      data: JSON.parse(cached.data),
      fetched_at: cached.fetched_at,
      is_stale: true,
    };
  }

  // No cache - must fetch
  const data = await fetchFundamentals(normalizedSymbol);

  if (data !== null) {
    setFundamentalsCache(normalizedSymbol, data);
    return {
      data: data,
      fetched_at: new Date().toISOString(),
      is_stale: false,
    };
  }

  return {
    data: null,
    fetched_at: null,
    is_stale: false,
  };
}

/**
 * Calculate 52-week high and low from EOD data.
 */
export function calculate52WeekRange(
  eodData: EODRecord[] | null
): { week_52_high: number | null; week_52_low: number | null } {
  if (!eodData || eodData.length === 0) {
    return { week_52_high: null, week_52_low: null };
  }

  // Filter to last ~252 trading days (approximately 1 year)
  const recentData = eodData.slice(-252);

  const highs = recentData.map((r) => r.high).filter((h) => h > 0);
  const lows = recentData.map((r) => r.low).filter((l) => l > 0);

  return {
    week_52_high: highs.length > 0 ? Math.max(...highs) : null,
    week_52_low: lows.length > 0 ? Math.min(...lows) : null,
  };
}
