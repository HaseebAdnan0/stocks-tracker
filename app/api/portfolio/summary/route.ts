import { NextRequest, NextResponse } from 'next/server';
import { getAllHoldings, getAccountBalance } from '@/lib/db';
import { getCachedMarketWatch } from '@/lib/cache';
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
    // Check authentication
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get holdings filtered by user_id
    const holdings = getAllHoldings(user.id);
    const accountBalance = getAccountBalance(user.id);

    if (holdings.length === 0) {
      return NextResponse.json({
        total_investment: 0,
        total_current_value: 0,
        total_pnl: 0,
        total_pnl_percent: 0,
        realized_pl: 0,
        unrealized_pl: 0,
        total_pl: 0,
        account_balance: Math.round(accountBalance * 100) / 100,
        currently_invested: 0,
        cash_available: Math.round(accountBalance * 100) / 100,
        portfolio_value: Math.round(accountBalance * 100) / 100,
        best_performer: null,
        worst_performer: null,
        what_if: {
          actual: {
            total_shares: 0,
            total_invested: 0,
            current_value: 0,
            profit_loss: 0,
            unrealized_pl: 0,
            realized_pl: 0,
            total_pl: 0,
          },
          '10x': {
            total_shares: 0,
            total_invested: 0,
            current_value: 0,
            profit_loss: 0,
            unrealized_pl: 0,
            realized_pl: 0,
            total_pl: 0,
          },
          '100x': {
            total_shares: 0,
            total_invested: 0,
            current_value: 0,
            profit_loss: 0,
            unrealized_pl: 0,
            realized_pl: 0,
            total_pl: 0,
          },
        },
      });
    }

    let totalInvestment = 0;
    let totalCurrentValue = 0;
    let totalShares = 0;
    let totalRealizedPL = 0;
    let totalUnrealizedPL = 0;
    const performers: { symbol: string; pnl_percent: number }[] = [];

    for (const holding of holdings) {
      const isSold = holding.status === 'sold';

      // Sum up realized P/L from all holdings
      if (holding.realized_pl) {
        totalRealizedPL += holding.realized_pl;
      }

      // Only calculate unrealized P/L for active holdings with quantity > 0
      if (!isSold && holding.quantity > 0) {
        const currentPrice = await getCurrentPrice(holding.symbol);
        const buyPrice = holding.buy_price;
        const investment = buyPrice * holding.quantity;
        totalInvestment += investment;
        totalShares += holding.quantity;

        if (currentPrice !== null) {
          const currentValue = currentPrice * holding.quantity;
          totalCurrentValue += currentValue;

          const unrealizedPnl = currentValue - investment;
          totalUnrealizedPL += unrealizedPnl;

          const pnlPercent = investment > 0 ? (unrealizedPnl / investment) * 100 : 0;

          performers.push({
            symbol: holding.symbol,
            pnl_percent: pnlPercent,
          });
        } else {
          // If no current price, assume buy price
          totalCurrentValue += investment;
        }
      }
    }

    // Legacy total_pnl for backwards compatibility (unrealized only)
    const totalPnl = totalCurrentValue - totalInvestment;
    const totalPnlPercent = totalInvestment > 0 ? (totalPnl / totalInvestment) * 100 : 0;

    // New combined P/L metrics
    const totalPL = totalRealizedPL + totalUnrealizedPL;

    // Determine best and worst performers
    let bestPerformer = null;
    let worstPerformer = null;

    if (performers.length > 0) {
      performers.sort((a, b) => b.pnl_percent - a.pnl_percent);
      bestPerformer = {
        symbol: performers[0].symbol,
        pnl_percent: Math.round(performers[0].pnl_percent * 100) / 100,
      };
      worstPerformer = {
        symbol: performers[performers.length - 1].symbol,
        pnl_percent: Math.round(performers[performers.length - 1].pnl_percent * 100) / 100,
      };
    }

    // Calculate what-if multipliers. Each metric scales linearly with the multiplier.
    const buildWhatIf = (mult: number) => ({
      total_shares: totalShares * mult,
      total_invested: Math.round(totalInvestment * mult * 100) / 100,
      current_value: Math.round(totalCurrentValue * mult * 100) / 100,
      profit_loss: Math.round(totalPnl * mult * 100) / 100,
      unrealized_pl: Math.round(totalUnrealizedPL * mult * 100) / 100,
      realized_pl: Math.round(totalRealizedPL * mult * 100) / 100,
      total_pl: Math.round(totalPL * mult * 100) / 100,
    });

    const whatIf = {
      actual: buildWhatIf(1),
      '10x': buildWhatIf(10),
      '100x': buildWhatIf(100),
    };

    // Account-level metrics
    const currentlyInvested = totalInvestment; // cost basis of active holdings
    // Cash = deposited amount - cost of active holdings + realized profits from sold stocks
    const cashAvailable = accountBalance - currentlyInvested + totalRealizedPL;
    // Portfolio value = current market value of active holdings + available cash
    const portfolioValue = totalCurrentValue + Math.max(cashAvailable, 0);

    return NextResponse.json({
      total_investment: Math.round(totalInvestment * 100) / 100,
      total_current_value: Math.round(totalCurrentValue * 100) / 100,
      total_pnl: Math.round(totalPnl * 100) / 100,
      total_pnl_percent: Math.round(totalPnlPercent * 100) / 100,
      realized_pl: Math.round(totalRealizedPL * 100) / 100,
      unrealized_pl: Math.round(totalUnrealizedPL * 100) / 100,
      total_pl: Math.round(totalPL * 100) / 100,
      account_balance: Math.round(accountBalance * 100) / 100,
      currently_invested: Math.round(currentlyInvested * 100) / 100,
      cash_available: Math.round(cashAvailable * 100) / 100,
      portfolio_value: Math.round(portfolioValue * 100) / 100,
      best_performer: bestPerformer,
      worst_performer: worstPerformer,
      what_if: whatIf,
    });
  } catch (error) {
    console.error('Error calculating portfolio summary:', error);
    return NextResponse.json({ error: 'Failed to calculate portfolio summary' }, { status: 500 });
  }
}
