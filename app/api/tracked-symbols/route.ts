import { NextResponse } from 'next/server';
import { getTrackedSymbols, addTrackedSymbol, removeTrackedSymbol } from '@/lib/db';

// GET /api/tracked-symbols - List all tracked symbols
export async function GET() {
  try {
    const symbols = getTrackedSymbols();
    return NextResponse.json({ data: symbols });
  } catch (error) {
    console.error('Error fetching tracked symbols:', error);
    return NextResponse.json({ error: 'Failed to fetch tracked symbols' }, { status: 500 });
  }
}

// POST /api/tracked-symbols - Add a new tracked symbol
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { symbol, name } = body;

    if (!symbol || typeof symbol !== 'string') {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    const cleanSymbol = symbol.toUpperCase().trim();
    if (!/^[A-Z0-9]+$/.test(cleanSymbol)) {
      return NextResponse.json({ error: 'Invalid symbol format' }, { status: 400 });
    }

    const result = addTrackedSymbol(cleanSymbol, name);
    if (!result) {
      return NextResponse.json({ error: 'Symbol already tracked' }, { status: 409 });
    }

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error('Error adding tracked symbol:', error);
    return NextResponse.json({ error: 'Failed to add tracked symbol' }, { status: 500 });
  }
}

// DELETE /api/tracked-symbols - Remove a tracked symbol
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    const removed = removeTrackedSymbol(symbol);
    if (!removed) {
      return NextResponse.json({ error: 'Symbol not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing tracked symbol:', error);
    return NextResponse.json({ error: 'Failed to remove tracked symbol' }, { status: 500 });
  }
}
