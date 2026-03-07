import { NextResponse } from 'next/server';
import { KMI_30_STOCKS, KMI_ALL_SHARES_STOCKS, IndexType } from '@/lib/config';
import { getCachedMarketWatch, getCachedEodHistory, calculate52WeekRange } from '@/lib/cache';

// Helper to process items in batches with delay between batches
async function processBatches<T, R>(
  items: T[],
  batchSize: number,
  delayMs: number,
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
    // Add delay between batches (but not after the last batch)
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return results;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const indexParam = searchParams.get('index') as IndexType | null;

    // Determine which index to use
    const selectedIndex: IndexType = indexParam === 'KMIALLSHR' ? 'KMIALLSHR' : 'KMI30';
    const indexStocks = selectedIndex === 'KMI30' ? KMI_30_STOCKS : KMI_ALL_SHARES_STOCKS;
    const indexSymbols = indexStocks.map(s => s.symbol);

    // Get market watch data from cache
    const { data: marketData, fetched_at, is_stale } = await getCachedMarketWatch();

    if (!marketData) {
      return NextResponse.json(
        { error: 'Unable to fetch market data', data: [], is_stale: false },
        { status: 503 }
      );
    }

    // Filter to only index symbols
    const filteredData = marketData.filter((stock) => indexSymbols.includes(stock.symbol));

    // Enrich with 52-week high/low from EOD data
    // Use small batches with delays to avoid rate limiting PSX API
    // Only fetch for first 30 stocks on KMI30, skip EOD entirely for KMIALLSHR to avoid overwhelming API
    const maxEodFetches = selectedIndex === 'KMIALLSHR' ? 0 : 30;
    const stocksToEnrich = filteredData.slice(0, maxEodFetches);
    const stocksWithoutEod = filteredData.slice(maxEodFetches);

    // Process in batches of 5 with 500ms delay between batches
    const enrichedStocks = await processBatches(
      stocksToEnrich,
      5,
      500,
      async (stock) => {
        const { data: eodData } = await getCachedEodHistory(stock.symbol);
        const { week_52_high, week_52_low } = calculate52WeekRange(eodData);
        return {
          ...stock,
          week_52_high,
          week_52_low,
        };
      }
    );

    // Add remaining stocks without EOD data
    const remainingStocks = stocksWithoutEod.map(stock => ({
      ...stock,
      week_52_high: null,
      week_52_low: null,
    }));

    const enrichedData = [...enrichedStocks, ...remainingStocks];

    // Calculate index summary for filtered symbols
    let indexSummary = null;
    if (enrichedData.length > 0) {
      const totalVolume = enrichedData.reduce((sum, stock) => sum + (stock.volume || 0), 0);

      const changes = enrichedData
        .map((stock) => stock.change_percent)
        .filter((c) => c !== null && c !== undefined);
      const avgChange = changes.length > 0 ? changes.reduce((a, b) => a + b, 0) / changes.length : 0;

      const stocksUp = enrichedData.filter((stock) => (stock.change || 0) > 0).length;
      const stocksDown = enrichedData.filter((stock) => (stock.change || 0) < 0).length;
      const stocksUnchanged = enrichedData.length - stocksUp - stocksDown;

      indexSummary = {
        total_volume: totalVolume,
        avg_change_percent: Math.round(avgChange * 100) / 100,
        stocks_up: stocksUp,
        stocks_down: stocksDown,
        stocks_unchanged: stocksUnchanged,
        total_stocks: enrichedData.length,
      };
    }

    const response: Record<string, unknown> = {
      data: enrichedData,
      fetched_at,
      is_stale,
      index: selectedIndex,
    };

    if (indexSummary) {
      response.index_summary = indexSummary;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in market-watch API:', error);
    return NextResponse.json(
      { error: 'Internal server error', data: [], is_stale: false },
      { status: 500 }
    );
  }
}
