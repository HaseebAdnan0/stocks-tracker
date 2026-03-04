/**
 * API endpoint for retrieving transaction history.
 * Supports filtering by symbol and transaction type.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTransactions } from '@/lib/db';
import { getCurrentUser } from '@/lib/middleware';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || undefined;
    const type = searchParams.get('type') as 'buy' | 'sell' | null;

    // Validate type parameter if provided
    if (type && type !== 'buy' && type !== 'sell') {
      return NextResponse.json(
        { error: 'Invalid type parameter. Must be "buy" or "sell"' },
        { status: 400 }
      );
    }

    // Get transactions with filters
    const filters = {
      ...(symbol && { symbol }),
      ...(type && { type }),
    };

    const transactions = getTransactions(user.id, Object.keys(filters).length > 0 ? filters : undefined);

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
