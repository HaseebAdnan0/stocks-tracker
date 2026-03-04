/**
 * Formatting utility functions for PSX Tracker.
 */

/**
 * Format number as PKR currency with commas and 2 decimal places.
 */
export function formatPKR(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return 'PKR 0.00';
  }

  const isNegative = value < 0;
  const absoluteValue = Math.abs(value);

  const formatted = absoluteValue.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return isNegative ? `-PKR ${formatted}` : `PKR ${formatted}`;
}

/**
 * Format number with commas (for volume, etc.).
 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }

  return value.toLocaleString('en-PK');
}

/**
 * Format percentage with + or - sign and 2 decimal places.
 */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0.00%';
  }

  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * Format market cap with abbreviations (M for millions, B for billions).
 */
export function formatMarketCap(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return 'Data unavailable';
  }

  if (value >= 1_000_000_000) {
    return `PKR ${(value / 1_000_000_000).toFixed(2)}B`;
  } else if (value >= 1_000_000) {
    return `PKR ${(value / 1_000_000).toFixed(2)}M`;
  } else if (value >= 1_000) {
    return `PKR ${(value / 1_000).toFixed(2)}K`;
  } else {
    return formatPKR(value);
  }
}
