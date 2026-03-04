import { NextResponse } from 'next/server';
import { KMI_30_SYMBOLS } from '@/lib/config';

export async function GET() {
  const indices = [
    {
      name: 'KMI-30',
      symbols: KMI_30_SYMBOLS,
    },
  ];

  return NextResponse.json({ indices });
}
