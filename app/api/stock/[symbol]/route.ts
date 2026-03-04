import { NextResponse } from 'next/server';
import { KMI_30_SYMBOLS } from '@/lib/config';
import {
  getCachedMarketWatch,
  getCachedEodHistory,
  getCachedFundamentals,
  calculate52WeekRange,
} from '@/lib/cache';
import { fetchDividendHistory } from '@/lib/scraper';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol: rawSymbol } = await params;
    const symbol = rawSymbol.toUpperCase();

    // Get current market data
    const { data: marketData, fetched_at: marketFetchedAt, is_stale: marketIsStale } =
      await getCachedMarketWatch();

    let currentData = null;
    if (marketData) {
      currentData = marketData.find((stock) => stock.symbol === symbol);
    }

    if (!currentData) {
      return NextResponse.json({ error: `Stock symbol '${symbol}' not found` }, { status: 404 });
    }

    // Get EOD history
    const { data: eodData, fetched_at: eodFetchedAt, is_stale: eodIsStale } =
      await getCachedEodHistory(symbol);

    // Filter to last 5 years
    let eodHistory = eodData || [];
    if (eodHistory.length > 1260) {
      eodHistory = eodHistory.slice(-1260);
    }

    // Calculate 52-week range
    const { week_52_high, week_52_low } = calculate52WeekRange(eodData);

    // Get fundamentals
    const { data: fundamentals } = await getCachedFundamentals(symbol);

    // Get dividend history
    let dividendHistory: { announcement_date: string; type: string; amount: number }[] | null = null;
    try {
      dividendHistory = await fetchDividendHistory(symbol);
    } catch (error) {
      console.error(`Error fetching dividend history for ${symbol}:`, error);
    }

    // Determine which indices the stock belongs to
    const indices: string[] = [];
    if (KMI_30_SYMBOLS.includes(symbol as never)) {
      indices.push('kmi30');
    }

    // Determine overall staleness
    const isStale = marketIsStale || eodIsStale;

    // Use the most recent fetched_at timestamp
    let fetchedAt = marketFetchedAt;
    if (eodFetchedAt && (!fetchedAt || new Date(eodFetchedAt) > new Date(fetchedAt))) {
      fetchedAt = eodFetchedAt;
    }

    return NextResponse.json({
      symbol,
      current_data: currentData,
      market_data: {
        ...currentData,
        week_52_high,
        week_52_low,
      },
      eod_history: eodHistory,
      fundamentals,
      dividend_history: dividendHistory || [],
      indices,
      fetched_at: fetchedAt,
      is_stale: isStale,
    });
  } catch (error) {
    console.error('Error in stock detail API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
