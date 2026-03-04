import { NextResponse } from 'next/server';
import { getTrackedSymbolsList } from '@/lib/db';
import { getCachedMarketWatch, getCachedEodHistory, calculate52WeekRange } from '@/lib/cache';

export async function GET() {
  try {
    // Get market watch data from cache
    const { data: marketData, fetched_at, is_stale } = await getCachedMarketWatch();

    if (!marketData) {
      return NextResponse.json(
        { error: 'Unable to fetch market data', data: [], is_stale: false },
        { status: 503 }
      );
    }

    // Get tracked symbols from database
    const trackedSymbols = getTrackedSymbolsList();

    // Filter to only tracked symbols
    let filteredData = marketData.filter((stock) => trackedSymbols.includes(stock.symbol));

    // Enrich with 52-week high/low from EOD data
    const enrichedData = await Promise.all(
      filteredData.map(async (stock) => {
        const { data: eodData } = await getCachedEodHistory(stock.symbol);
        const { week_52_high, week_52_low } = calculate52WeekRange(eodData);
        return {
          ...stock,
          week_52_high,
          week_52_low,
        };
      })
    );

    // Calculate index summary for tracked symbols
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
