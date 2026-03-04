/**
 * Utility functions for PSX market hours checking.
 */

import { PSX_MARKET_HOURS } from '@/lib/config';

/**
 * Check if PSX market is currently open.
 * Market hours: Mon-Fri 9:30 AM - 3:30 PM PKT
 */
export function isMarketOpen(): boolean {
  try {
    // Get current time in Pakistan timezone
    const now = new Date();
    const pktTime = new Date(
      now.toLocaleString('en-US', { timeZone: PSX_MARKET_HOURS.timezone })
    );

    // Check if it's a weekend (Saturday = 6, Sunday = 0)
    const dayOfWeek = pktTime.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }

    // Get current time in HH:MM format
    const hours = pktTime.getHours().toString().padStart(2, '0');
    const minutes = pktTime.getMinutes().toString().padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;

    // Check if current time is within market hours
    return currentTime >= PSX_MARKET_HOURS.start && currentTime <= PSX_MARKET_HOURS.end;
  } catch (error) {
    console.error('Error checking market hours:', error);
    return false;
  }
}

/**
 * Get market status message.
 */
export function getMarketStatusMessage(): string {
  if (isMarketOpen()) {
    return 'Market Open';
  }

  try {
    const now = new Date();
    const pktTime = new Date(
      now.toLocaleString('en-US', { timeZone: PSX_MARKET_HOURS.timezone })
    );
    const dayOfWeek = pktTime.getDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return 'Market Closed - Weekend';
    }

    return 'Market Closed';
  } catch {
    return 'Market Closed';
  }
}
