import { NextResponse } from 'next/server';
import { KMI_30_STOCKS, KMI_ALL_SHARES_STOCKS } from '@/lib/config';

export async function GET() {
  const indices = [
    {
      id: 'KMI30',
      name: 'KMI-30',
      description: 'Top 30 Shariah-compliant stocks by market cap',
      stocks: KMI_30_STOCKS,
      symbols: KMI_30_STOCKS.map(s => s.symbol),
    },
    {
      id: 'KMIALLSHR',
      name: 'KMI All Shares',
      description: 'All Shariah-compliant stocks on PSX',
      stocks: KMI_ALL_SHARES_STOCKS,
      symbols: KMI_ALL_SHARES_STOCKS.map(s => s.symbol),
    },
  ];

  return NextResponse.json({ indices });
}
