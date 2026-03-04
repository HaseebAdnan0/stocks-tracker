import { NextRequest, NextResponse } from 'next/server';
import { getHoldingById, updateHolding, deleteHolding, verifyHoldingOwnership } from '@/lib/db';
import { getCachedMarketWatch } from '@/lib/cache';
import { getCurrentUser } from '@/lib/middleware';

// Helper to get current price for a symbol
async function getCurrentPrice(symbol: string): Promise<number | null> {
  const { data: marketData } = await getCachedMarketWatch();
  if (!marketData) return null;

  const stock = marketData.find((s) => s.symbol === symbol);
  return stock?.current ?? null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id: idStr } = await params;
    const holdingId = parseInt(idStr);

    if (isNaN(holdingId)) {
      return NextResponse.json({ error: 'Invalid holding ID' }, { status: 400 });
    }

    const existingHolding = getHoldingById(holdingId);
    if (!existingHolding) {
      return NextResponse.json({ error: `Holding with id ${holdingId} not found` }, { status: 404 });
    }

    // Verify ownership
    if (!verifyHoldingOwnership(holdingId, user.id)) {
      return NextResponse.json({ error: 'Not authorized to modify this holding' }, { status: 403 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    // Validate and add updates
    if ('symbol' in body) {
      const symbol = String(body.symbol).toUpperCase();
      const { data: marketData } = await getCachedMarketWatch();
      if (marketData) {
        const symbolExists = marketData.some((stock) => stock.symbol === symbol);
        if (!symbolExists) {
          return NextResponse.json(
            { error: `Symbol '${symbol}' not found in market data.` },
            { status: 400 }
          );
        }
      }
      updates.symbol = symbol;
    }

    if ('quantity' in body) {
      const quantity = parseInt(body.quantity);
      if (isNaN(quantity) || quantity <= 0) {
        return NextResponse.json({ error: 'Quantity must be a positive integer' }, { status: 400 });
      }
      updates.quantity = quantity;
    }

    if ('buy_price' in body) {
      const buyPrice = parseFloat(body.buy_price);
      if (isNaN(buyPrice) || buyPrice <= 0) {
        return NextResponse.json({ error: 'Buy price must be a positive number' }, { status: 400 });
      }
      updates.buy_price = buyPrice;
    }

    if ('buy_date' in body) {
      const buyDate = String(body.buy_date);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(buyDate)) {
        return NextResponse.json({ error: 'Buy date must be in YYYY-MM-DD format' }, { status: 400 });
      }
      updates.buy_date = buyDate;
    }

    if ('broker' in body) {
      updates.broker = body.broker;
    }

    if ('notes' in body) {
      updates.notes = body.notes;
    }

    const holding = updateHolding(holdingId, updates);

    if (!holding) {
      return NextResponse.json({ error: 'Failed to update holding' }, { status: 500 });
    }

    // Get current price for response
    const currentPrice = await getCurrentPrice(holding.symbol);
    const buyPrice = holding.buy_price;
    const quantity = holding.quantity;
    const investment = buyPrice * quantity;

    let currentValue = null;
    let pnl = null;
    let pnlPercent = null;
    let change = null;
    let changePercent = null;

    if (currentPrice !== null) {
      currentValue = currentPrice * quantity;
      pnl = currentValue - investment;
      pnlPercent = investment > 0 ? (pnl / investment) * 100 : 0;
      change = currentPrice - buyPrice;
      changePercent = buyPrice > 0 ? (change / buyPrice) * 100 : 0;
    }

    return NextResponse.json({
      id: holding.id,
      symbol: holding.symbol,
      quantity: holding.quantity,
      buy_price: holding.buy_price,
      buy_date: holding.buy_date,
      broker: holding.broker,
      notes: holding.notes,
      current_price: currentPrice,
      change: change !== null ? Math.round(change * 100) / 100 : null,
      change_percent: changePercent !== null ? Math.round(changePercent * 100) / 100 : null,
      investment: Math.round(investment * 100) / 100,
      current_value: currentValue !== null ? Math.round(currentValue * 100) / 100 : null,
      pnl: pnl !== null ? Math.round(pnl * 100) / 100 : null,
      pnl_percent: pnlPercent !== null ? Math.round(pnlPercent * 100) / 100 : null,
      created_at: holding.created_at,
      updated_at: holding.updated_at,
    });
  } catch (error) {
    console.error('Error updating holding:', error);
    return NextResponse.json({ error: 'Failed to update holding' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id: idStr } = await params;
    const holdingId = parseInt(idStr);

    if (isNaN(holdingId)) {
      return NextResponse.json({ error: 'Invalid holding ID' }, { status: 400 });
    }

    const existingHolding = getHoldingById(holdingId);
    if (!existingHolding) {
      return NextResponse.json({ error: `Holding with id ${holdingId} not found` }, { status: 404 });
    }

    // Verify ownership
    if (!verifyHoldingOwnership(holdingId, user.id)) {
      return NextResponse.json({ error: 'Not authorized to delete this holding' }, { status: 403 });
    }

    deleteHolding(holdingId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting holding:', error);
    return NextResponse.json({ error: 'Failed to delete holding' }, { status: 500 });
  }
}
