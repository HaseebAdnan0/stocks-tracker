import { NextResponse } from 'next/server';
import { getCacheStatus } from '@/lib/db';
import { CACHE_DURATION } from '@/lib/config';

export async function GET() {
  try {
    const status = getCacheStatus();

    return NextResponse.json({
      market_watch: {
        last_updated: status.market_watch.last_updated,
        age_seconds: status.market_watch.age_seconds,
        cache_duration: CACHE_DURATION.market_watch,
      },
      eod_data: {
        total_cached_symbols: status.eod_data.total_cached_symbols,
        oldest_cache: status.eod_data.oldest_cache,
        cache_duration: CACHE_DURATION.eod,
      },
      fundamentals: {
        total_cached_symbols: status.fundamentals.total_cached_symbols,
        oldest_cache: status.fundamentals.oldest_cache,
        cache_duration: CACHE_DURATION.fundamentals,
      },
    });
  } catch (error) {
    console.error('Error fetching cache status:', error);
    return NextResponse.json({ error: 'Failed to fetch cache status' }, { status: 500 });
  }
}
