import { NextRequest, NextResponse } from 'next/server';
import { getAllHoldings, createHolding } from '@/lib/db';
import { getCachedMarketWatch } from '@/lib/cache';
import { isKmi30, isShariahCompliant, getStockName } from '@/lib/config';
import { getCurrentUser } from '@/lib/middleware';

// Helper to get current price for a symbol
async function getCurrentPrice(symbol: string): Promise<number | null> {
  const { data: marketData } = await getCachedMarketWatch();
  if (!marketData) return null;

  const stock = marketData.find((s) => s.symbol === symbol);
  return stock?.current ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status'); // 'active' | 'archived' | null

    const allHoldings = getAllHoldings(user.id);
    const holdings = allHoldings.filter((h) => {
      if (statusFilter === 'active') return h.quantity > 0;
      if (statusFilter === 'archived') return h.quantity === 0;
      return true;
    });

    const holdingsData = await Promise.all(
      holdings.map(async (holding) => {
        const currentPrice = await getCurrentPrice(holding.symbol);
        const buyPrice = holding.buy_price;
        const investment = buyPrice * holding.quantity;

        let currentValue = null;
        let pnl = null;
        let pnlPercent = null;
        let change = null;
        let changePercent = null;

        if (currentPrice !== null) {
          currentValue = currentPrice * holding.quantity;
          pnl = currentValue - investment;
          pnlPercent = investment > 0 ? (pnl / investment) * 100 : 0;
          change = currentPrice - buyPrice;
          changePercent = buyPrice > 0 ? (change / buyPrice) * 100 : 0;
        }

        const indices: string[] = [];
        if (isKmi30(holding.symbol)) {
          indices.push('kmi30');
        } else if (isShariahCompliant(holding.symbol)) {
          indices.push('kmi_all_share');
        }

        const soldQty = holding.total_sold_quantity || 0;
        const soldValue = holding.total_sold_value || 0;
        const avgSellPrice = soldQty > 0 ? soldValue / soldQty : null;
        // For a fully sold holding, original investment = buy_price * soldQty.
        // For partially sold, investment already reflects remaining qty only.
        const isFullySold = holding.quantity === 0 && soldQty > 0;
        const originalInvestment = isFullySold
          ? buyPrice * soldQty
          : Math.round(investment * 100) / 100;

        return {
          id: holding.id,
          symbol: holding.symbol,
          name: getStockName(holding.symbol) || null,
          quantity: holding.quantity,
          buy_price: buyPrice,
          buy_date: holding.buy_date,
          broker: holding.broker,
          notes: holding.notes,
          current_price: currentPrice,
          change: change !== null ? Math.round(change * 100) / 100 : null,
          change_percent: changePercent !== null ? Math.round(changePercent * 100) / 100 : null,
          investment: isFullySold
            ? Math.round(originalInvestment * 100) / 100
            : Math.round(investment * 100) / 100,
          current_value: currentValue !== null ? Math.round(currentValue * 100) / 100 : null,
          pnl: pnl !== null ? Math.round(pnl * 100) / 100 : null,
          pnl_percent: pnlPercent !== null ? Math.round(pnlPercent * 100) / 100 : null,
          created_at: holding.created_at,
          updated_at: holding.updated_at,
          indices,
          status: holding.status || 'active',
          realized_pl: holding.realized_pl || 0,
          total_sold_quantity: soldQty,
          total_sold_value: Math.round(soldValue * 100) / 100,
          avg_sell_price: avgSellPrice !== null ? Math.round(avgSellPrice * 100) / 100 : null,
        };
      })
    );

    return NextResponse.json({ holdings: holdingsData });
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    return NextResponse.json({ error: 'Failed to fetch portfolio' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    const requiredFields = ['symbol', 'quantity', 'buy_price', 'buy_date'];
    const missingFields = requiredFields.filter((field) => !(field in body));
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    const symbol = String(body.symbol).toUpperCase();
    const quantity = parseInt(body.quantity);
    const buyPrice = parseFloat(body.buy_price);
    const buyDate = String(body.buy_date);
    const broker = body.broker || 'HMFS';
    const notes = body.notes || null;

    // Validate symbol exists in market data
    const { data: marketData } = await getCachedMarketWatch();
    if (marketData) {
      const symbolExists = marketData.some((stock) => stock.symbol === symbol);
      if (!symbolExists) {
        return NextResponse.json(
          { error: `Symbol '${symbol}' not found in market data. Please verify the symbol.` },
          { status: 400 }
        );
      }
    }

    // Validate quantity
    if (isNaN(quantity) || quantity <= 0) {
      return NextResponse.json({ error: 'Quantity must be a positive integer' }, { status: 400 });
    }

    // Validate buy price
    if (isNaN(buyPrice) || buyPrice <= 0) {
      return NextResponse.json({ error: 'Buy price must be a positive number' }, { status: 400 });
    }

    // Validate buy date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(buyDate)) {
      return NextResponse.json({ error: 'Buy date must be in YYYY-MM-DD format' }, { status: 400 });
    }

    // Create holding
    const holding = createHolding({
      user_id: user.id,
      symbol,
      quantity,
      buy_price: buyPrice,
      buy_date: buyDate,
      broker,
      notes,
    });

    // Get current price for response
    const currentPrice = await getCurrentPrice(symbol);
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

    return NextResponse.json(
      {
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
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating holding:', error);
    return NextResponse.json({ error: 'Failed to create holding' }, { status: 500 });
  }
}
