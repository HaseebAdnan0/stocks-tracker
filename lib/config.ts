/**
 * Configuration module for PSX Shariah Portfolio Tracker.
 *
 * Contains configuration constants for market data scraping,
 * caching, and KMI-30 index symbols.
 */

// KMI-30 Shariah-compliant index symbols (December 2024)
export const KMI_30_SYMBOLS = [
  'LUCK',
  'HUBC',
  'MEBL',
  'PSO',
  'OGDC',
  'PPL',
  'MARI',
  'SYS',
  'ENGRO',
  'FFC',
  'EFERT',
  'BAHL',
  'SAZEW',
  'MTL',
  'SEARL',
  'CHCC',
  'MLCF',
  'PIOC',
  'GWLC',
  'COLG',
  'GADT',
  'NESTLE',
  'NETSOL',
  'OCTOPUS',
  'TOMCL',
  'AVN',
  'ISL',
  'FHAM',
  'ATRL',
  'KOHC',
] as const;

export type KMI30Symbol = (typeof KMI_30_SYMBOLS)[number];

// Cache duration settings (in seconds)
export const CACHE_DURATION = {
  market_watch: 15, // 15 seconds - real-time updates via PSX Terminal
  eod: 86400, // 24 hours - for end-of-day historical data
  fundamentals: 86400, // 24 hours - for company fundamentals
} as const;

// PSX market hours configuration (Pakistan Standard Time - Asia/Karachi)
export const PSX_MARKET_HOURS = {
  start: '09:30', // Market opens at 9:30 AM
  end: '15:30', // Market closes at 3:30 PM
  timezone: 'Asia/Karachi',
} as const;

// User-Agent header for HTTP requests to PSX servers
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
