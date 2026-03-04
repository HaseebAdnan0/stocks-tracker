import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/middleware';
import {
  getHoldingById,
  updateHolding,
  createTransaction,
  verifyHoldingOwnership,
} from '@/lib/db';

/**
 * POST /api/portfolio/[id]/sell
 * Record a sell transaction for a holding
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const holdingId = parseInt(id);
    if (isNaN(holdingId)) {
      return NextResponse.json({ error: 'Invalid holding ID' }, { status: 400 });
    }

    // Check if holding exists
    const holding = getHoldingById(holdingId);
    if (!holding) {
      return NextResponse.json({ error: 'Holding not found' }, { status: 404 });
    }

    // Verify ownership
    if (!verifyHoldingOwnership(holdingId, user.id)) {
      return NextResponse.json(
        { error: 'Not authorized to sell this holding' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { quantity, price, date } = body;

    // Validate inputs
    if (!quantity || !price || !date) {
      return NextResponse.json(
        { error: 'Missing required fields: quantity, price, date' },
        { status: 400 }
      );
    }

    const sellQuantity = parseInt(quantity);
    const sellPrice = parseFloat(price);

    if (isNaN(sellQuantity) || sellQuantity <= 0) {
      return NextResponse.json(
        { error: 'Quantity must be a positive number' },
        { status: 400 }
      );
    }

    if (isNaN(sellPrice) || sellPrice <= 0) {
      return NextResponse.json(
        { error: 'Price must be a positive number' },
        { status: 400 }
      );
    }

    // Validate quantity <= current holding quantity
    if (sellQuantity > holding.quantity) {
      return NextResponse.json(
        {
          error: `Cannot sell ${sellQuantity} shares. Only ${holding.quantity} shares available.`,
        },
        { status: 400 }
      );
    }

    // Calculate realized P/L for this sale
    // Realized P/L = (sell_price - buy_price) * quantity
    const realizedPL = (sellPrice - holding.buy_price) * sellQuantity;

    // Create transaction record
    createTransaction({
      user_id: user.id,
      holding_id: holdingId,
      symbol: holding.symbol,
      type: 'sell',
      quantity: sellQuantity,
      price: sellPrice,
      date: date,
    });

    // Calculate new values
    const newQuantity = holding.quantity - sellQuantity;
    const currentRealizedPL = holding.realized_pl || 0;
    const currentTotalSoldQty = holding.total_sold_quantity || 0;
    const currentTotalSoldValue = holding.total_sold_value || 0;

    const updatedRealizedPL = currentRealizedPL + realizedPL;
    const updatedTotalSoldQty = currentTotalSoldQty + sellQuantity;
    const updatedTotalSoldValue = currentTotalSoldValue + sellPrice * sellQuantity;

    // Update holding
    const updates: {
      quantity: number;
      realized_pl: number;
      total_sold_quantity: number;
      total_sold_value: number;
      status?: 'sold';
    } = {
      quantity: newQuantity,
      realized_pl: updatedRealizedPL,
      total_sold_quantity: updatedTotalSoldQty,
      total_sold_value: updatedTotalSoldValue,
    };

    // Mark as sold if quantity becomes 0
    if (newQuantity === 0) {
      updates.status = 'sold';
    }

    const updatedHolding = updateHolding(holdingId, updates);

    return NextResponse.json({
      success: true,
      message: `Sold ${sellQuantity} shares of ${holding.symbol}`,
      holding: updatedHolding,
      realized_pl: realizedPL,
    });
  } catch (error) {
    console.error('Error processing sell transaction:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
