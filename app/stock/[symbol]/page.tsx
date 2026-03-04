'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import LoadingSpinner from '@/components/LoadingSpinner';
import ShariahBadge from '@/components/ShariahBadge';
import StaleDataWarning from '@/components/StaleDataWarning';
import AddHoldingModal from '@/components/AddHoldingModal';
import PriceChart from '@/components/PriceChart';
import { formatPKR, formatNumber, formatPercent, formatMarketCap } from '@/utils/formatters';

interface MarketData {
  name: string;
  ldcp: number;
  open: number;
  high: number;
  low: number;
  current: number;
  change: number;
  change_percent: number;
  volume: number;
  week_52_high: number | null;
  week_52_low: number | null;
}

interface Fundamentals {
  eps: number | null;
  pe_ratio: number | null;
  book_value: number | null;
  market_cap: number | null;
  dividend_yield: number | null;
  sector: string | null;
}

interface DividendRecord {
  announcement_date: string;
  type: string;
  amount: number;
}

interface Transaction {
  id: number;
  user_id: number;
  holding_id: number | null;
  symbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  date: string;
  created_at: string;
}

interface StockData {
  symbol: string;
  market_data: MarketData;
  fundamentals: Fundamentals | null;
  dividend_history: DividendRecord[];
  indices: string[];
  is_stale: boolean;
  fetched_at: string;
}

function StockDetailContent({ params }: { params: Promise<{ symbol: string }> }) {
  const resolvedParams = use(params);
  const symbol = resolvedParams.symbol.toUpperCase();
  const router = useRouter();
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInPortfolio, setIsInPortfolio] = useState(false);
  const [buyPrice, setBuyPrice] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  useEffect(() => {
    fetchStockData();
    checkPortfolio();
    fetchTransactions();
  }, [symbol]);

  const fetchStockData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/stock/${symbol}`);
      if (!response.ok) {
        throw new Error('Failed to fetch stock data');
      }

      const result = await response.json();
      setStockData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching stock data:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkPortfolio = async () => {
    try {
      const response = await fetch('/api/portfolio');
      if (!response.ok) return;

      const result = await response.json();
      const holdings = result.holdings || [];
      const holding = holdings.find(
        (h: { symbol: string; buy_price: number }) => h.symbol.toUpperCase() === symbol
      );

      if (holding) {
        setIsInPortfolio(true);
        setBuyPrice(holding.buy_price);
      } else {
        setIsInPortfolio(false);
        setBuyPrice(null);
      }
    } catch (err) {
      console.error('Error checking portfolio:', err);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoadingTransactions(true);
      const response = await fetch(`/api/transactions?symbol=${symbol}`);
      if (!response.ok) {
        console.error('Failed to fetch transactions');
        return;
      }

      const result = await response.json();
      setTransactions(result.transactions || []);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleAddSuccess = () => {
    setIsInPortfolio(true);
    checkPortfolio();
    fetchTransactions(); // Refresh transactions after adding to portfolio
  };

  if (loading) {
    return <LoadingSpinner message={`Loading ${symbol} details...`} />;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <h3 className="text-xl font-semibold text-white mb-2">Unable to Load Stock Data</h3>
        <p className="text-gray-400 mb-6">Could not fetch data for {symbol}.</p>
        <button
          onClick={() => router.back()}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!stockData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-4">No data available for {symbol}</p>
        <button onClick={() => router.back()} className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded">
          Go Back
        </button>
      </div>
    );
  }

  const { market_data, indices, fundamentals, dividend_history, is_stale, fetched_at } = stockData;

  const calculateLast12MonthsDividends = () => {
    if (!dividend_history || dividend_history.length === 0) return 0;

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

    return dividend_history
      .filter((dividend) => new Date(dividend.announcement_date) >= twelveMonthsAgo)
      .reduce((sum, dividend) => sum + (dividend.amount || 0), 0);
  };

  const totalLast12Months = calculateLast12MonthsDividends();

  return (
    <div>
      <button
        onClick={() => router.back()}
        className="mb-6 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
      >
        &larr; Back
      </button>

      <div className="bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-white">{symbol}</h1>
              <ShariahBadge indices={indices} size="sm" />
              <StaleDataWarning isStale={is_stale} lastUpdated={fetched_at ? new Date(fetched_at) : null} />
            </div>
            <p className="text-gray-400 mt-1">{market_data?.name || 'Company Name'}</p>
          </div>

          <div className="text-right">
            <div className={`text-4xl font-bold ${market_data?.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatPKR(market_data?.current)}
            </div>
            <div className={`text-lg ${market_data?.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {market_data?.change >= 0 ? '+' : ''}
              {formatPKR(market_data?.change)} ({formatPercent(market_data?.change_percent)})
            </div>
          </div>
        </div>

        {!isInPortfolio && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <button
              onClick={() => setShowAddModal(true)}
              className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add to Portfolio
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">LDCP</div>
          <div className="text-white text-xl font-semibold">{formatPKR(market_data?.ldcp)}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Open</div>
          <div className="text-white text-xl font-semibold">{formatPKR(market_data?.open)}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">High</div>
          <div className="text-white text-xl font-semibold">{formatPKR(market_data?.high)}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Low</div>
          <div className="text-white text-xl font-semibold">{formatPKR(market_data?.low)}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Volume</div>
          <div className="text-white text-xl font-semibold">{formatNumber(market_data?.volume)}</div>
        </div>
        {market_data?.week_52_high && (
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">52W High</div>
            <div className="text-white text-xl font-semibold">{formatPKR(market_data?.week_52_high)}</div>
          </div>
        )}
        {market_data?.week_52_low && (
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">52W Low</div>
            <div className="text-white text-xl font-semibold">{formatPKR(market_data?.week_52_low)}</div>
          </div>
        )}
      </div>

      <PriceChart symbol={symbol} buyPrice={buyPrice} />

      <div className="bg-gray-800 rounded-lg shadow p-6 mt-6">
        <h2 className="text-2xl font-bold text-white mb-6">Fundamentals</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
            <div className="text-gray-400 text-sm mb-2 font-medium">Earnings Per Share (EPS)</div>
            <div className="text-white text-xl font-semibold">
              {fundamentals?.eps !== null ? `PKR ${fundamentals?.eps.toFixed(2)}` : 'Data unavailable'}
            </div>
          </div>

          <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
            <div className="text-gray-400 text-sm mb-2 font-medium">P/E Ratio</div>
            <div className="text-white text-xl font-semibold">
              {fundamentals?.pe_ratio !== null ? fundamentals?.pe_ratio.toFixed(2) : 'Data unavailable'}
            </div>
          </div>

          <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
            <div className="text-gray-400 text-sm mb-2 font-medium">Book Value</div>
            <div className="text-white text-xl font-semibold">
              {fundamentals?.book_value !== null ? formatPKR(fundamentals?.book_value) : 'Data unavailable'}
            </div>
          </div>

          <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
            <div className="text-gray-400 text-sm mb-2 font-medium">Market Cap</div>
            <div className="text-white text-xl font-semibold">{formatMarketCap(fundamentals?.market_cap)}</div>
          </div>

          <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
            <div className="text-gray-400 text-sm mb-2 font-medium">Dividend Yield</div>
            <div className="text-white text-xl font-semibold">
              {fundamentals?.dividend_yield !== null ? `${fundamentals?.dividend_yield.toFixed(2)}%` : 'Data unavailable'}
            </div>
          </div>

          <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
            <div className="text-gray-400 text-sm mb-2 font-medium">Sector</div>
            <div className="text-white text-xl font-semibold">{fundamentals?.sector || 'Data unavailable'}</div>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg shadow p-6 mt-6">
        <h2 className="text-2xl font-bold text-white mb-6">Dividend History</h2>

        {dividend_history && dividend_history.length > 0 ? (
          <>
            <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-gray-300 text-sm font-medium">Total Dividends (Last 12 Months)</span>
                <span className="text-blue-400 text-xl font-bold">{formatPKR(totalLast12Months)}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="px-4 py-3 text-gray-400 font-semibold text-sm">Date</th>
                    <th className="px-4 py-3 text-gray-400 font-semibold text-sm">Type</th>
                    <th className="px-4 py-3 text-gray-400 font-semibold text-sm text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {dividend_history.map((dividend, index) => (
                    <tr key={index} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3 text-white">
                        {new Date(dividend.announcement_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            dividend.type === 'Cash'
                              ? 'bg-green-500/20 text-green-400'
                              : dividend.type === 'Bonus'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-purple-500/20 text-purple-400'
                          }`}
                        >
                          {dividend.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white text-right font-semibold">{formatPKR(dividend.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-400 text-lg">No dividend history available</p>
          </div>
        )}
      </div>

      <div className="bg-gray-800 rounded-lg shadow p-6 mt-6">
        <h2 className="text-2xl font-bold text-white mb-6">Transaction History</h2>

        {loadingTransactions ? (
          <div className="text-center py-8">
            <p className="text-gray-400">Loading transactions...</p>
          </div>
        ) : transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="px-4 py-3 text-gray-400 font-semibold text-sm">Date</th>
                  <th className="px-4 py-3 text-gray-400 font-semibold text-sm">Type</th>
                  <th className="px-4 py-3 text-gray-400 font-semibold text-sm text-right">Quantity</th>
                  <th className="px-4 py-3 text-gray-400 font-semibold text-sm text-right">Price</th>
                  <th className="px-4 py-3 text-gray-400 font-semibold text-sm text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => {
                  const total = transaction.quantity * transaction.price;
                  const isBuy = transaction.type === 'buy';

                  return (
                    <tr
                      key={transaction.id}
                      className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-white">
                        {new Date(transaction.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold uppercase ${
                            isBuy ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {transaction.type}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${isBuy ? 'text-green-400' : 'text-red-400'}`}>
                        {formatNumber(transaction.quantity)}
                      </td>
                      <td className="px-4 py-3 text-white text-right">{formatPKR(transaction.price)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${isBuy ? 'text-green-400' : 'text-red-400'}`}>
                        {formatPKR(total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-400 text-lg">No transaction history available</p>
            <p className="text-gray-500 text-sm mt-2">
              Add this stock to your portfolio to start tracking transactions
            </p>
          </div>
        )}
      </div>

      <AddHoldingModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleAddSuccess}
        initialSymbol={symbol}
      />
    </div>
  );
}

export default function StockDetail({ params }: { params: Promise<{ symbol: string }> }) {
  return (
    <AuthGuard>
      <StockDetailContent params={params} />
    </AuthGuard>
  );
}
