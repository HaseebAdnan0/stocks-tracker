import { NextResponse } from 'next/server';
import { getCachedEodHistory } from '@/lib/cache';

// Map period strings to approximate trading days
const PERIOD_MAP: Record<string, number> = {
  '1M': 21,
  '3M': 63,
  '6M': 126,
  '1Y': 252,
  '3Y': 756,
  '5Y': 1260,
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol: rawSymbol } = await params;
    const symbol = rawSymbol.toUpperCase();
    const { searchParams } = new URL(request.url);

    let period = (searchParams.get('period') || '6M').toUpperCase();

    // Validate period
    if (!PERIOD_MAP[period]) {
      period = '6M';
    }

    const numDays = PERIOD_MAP[period];

    // Get EOD history from cache
    const { data: eodData } = await getCachedEodHistory(symbol);

    if (!eodData) {
      return NextResponse.json(
        { error: `No EOD data available for symbol '${symbol}'` },
        { status: 404 }
      );
    }

    // Filter to requested period (last N trading days)
    const filteredData = eodData.length > numDays ? eodData.slice(-numDays) : eodData;

    return NextResponse.json(filteredData);
  } catch (error) {
    console.error('Error in stock history API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
