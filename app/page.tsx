'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import LoadingSpinner from '@/components/LoadingSpinner';
import StaleDataWarning from '@/components/StaleDataWarning';
import { formatPKR, formatNumber, formatPercent } from '@/utils/formatters';
import { isMarketOpen, getMarketStatusMessage } from '@/utils/marketHours';
import { usePSXWebSocket, TickData } from '@/hooks/usePSXWebSocket';
import { IndexType, KMI_30_STOCKS, KMI_ALL_SHARES_STOCKS, getStockName } from '@/lib/config';

interface Stock {
  symbol: string;
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

interface IndexSummary {
  total_volume: number;
  avg_change_percent: number;
  stocks_up: number;
  stocks_down: number;
  stocks_unchanged: number;
  total_stocks: number;
}

const STOCKS_PER_PAGE = 30;

function DashboardContent() {
  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState<IndexType>('KMI30');
  const [marketData, setMarketData] = useState<Map<string, Stock>>(new Map());
  const [indexSummary, setIndexSummary] = useState<IndexSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'symbol', direction: 'asc' });
  const [marketStatus, setMarketStatus] = useState({ open: false, message: '' });
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [portfolioSymbols, setPortfolioSymbols] = useState<string[]>([]);
  const [isStale, setIsStale] = useState(false);
  const [tickCount, setTickCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Get symbols for current index
  const indexStocks = selectedIndex === 'KMI30' ? KMI_30_STOCKS : KMI_ALL_SHARES_STOCKS;
  const indexSymbols = indexStocks.map(s => s.symbol);

  // Handle incoming WebSocket ticks
  const handleTick = useCallback((tick: TickData) => {
    setMarketData((prev) => {
      const existing = prev.get(tick.symbol);
      const stockName = getStockName(tick.symbol) || existing?.name || tick.symbol;
      const next = new Map(prev);
      next.set(tick.symbol, {
        symbol: tick.symbol,
        name: stockName,
        ldcp: tick.ldcp,
        open: tick.open,
        high: tick.high,
        low: tick.low,
        current: tick.price,
        change: tick.change,
        change_percent: tick.changePercent * 100,
        volume: tick.volume,
        week_52_high: existing?.week_52_high ?? null,
        week_52_low: existing?.week_52_low ?? null,
      });
      return next;
    });
    setLastUpdated(new Date());
    setTickCount((c) => c + 1);
  }, []);

  // WebSocket connection for real-time data
  const { isConnected, error: wsError, reconnect } = usePSXWebSocket({
    symbols: indexSymbols,
    enabled: marketStatus.open && indexSymbols.length > 0,
    onTick: handleTick,
  });

  // Fetch data on mount and when index changes
  useEffect(() => {
    fetchPortfolioSymbols();
    updateMarketStatus();
  }, []);

  useEffect(() => {
    fetchInitialData();
    setCurrentPage(1); // Reset to first page when index changes
  }, [selectedIndex]);

  // Update market status every minute
  useEffect(() => {
    const statusInterval = setInterval(() => {
      updateMarketStatus();
    }, 60000);
    return () => clearInterval(statusInterval);
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/market-watch?index=${selectedIndex}`);
      if (!response.ok) throw new Error('Failed to fetch market data');

      const result = await response.json();
      const stocks = result.data || [];

      // Convert to Map and enrich with names
      const stockMap = new Map<string, Stock>();
      for (const stock of stocks) {
        if (indexSymbols.includes(stock.symbol)) {
          stockMap.set(stock.symbol, {
            ...stock,
            name: getStockName(stock.symbol) || stock.name || stock.symbol,
          });
        }
      }

      setMarketData(stockMap);
      setIndexSummary(result.index_summary || null);
      setLastUpdated(new Date(result.fetched_at));
      setIsStale(result.is_stale || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching market data:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateMarketStatus = () => {
    const open = isMarketOpen();
    const message = getMarketStatusMessage();
    setMarketStatus({ open, message });
  };

  const fetchPortfolioSymbols = async () => {
    try {
      const response = await fetch('/api/portfolio');
      if (!response.ok) return;
      const result = await response.json();
      const symbols = result.holdings?.map((h: { symbol: string }) => h.symbol) || [];
      setPortfolioSymbols(symbols);
    } catch (err) {
      console.error('Error fetching portfolio:', err);
    }
  };

  const handleManualRefresh = () => {
    fetchInitialData();
  };

  const handleRowClick = (symbol: string) => {
    setExpandedSymbol(expandedSymbol === symbol ? null : symbol);
  };

  const handleAddToPortfolio = (symbol: string) => {
    router.push(`/portfolio?add=${symbol}`);
  };

  const handleViewDetails = (symbol: string) => {
    router.push(`/stock/${symbol}`);
  };

  const getPriceColor = (current: number, ldcp: number) => {
    if (!current || !ldcp) return 'text-gray-400';
    if (current > ldcp) return 'text-green-500';
    if (current < ldcp) return 'text-red-500';
    return 'text-gray-400';
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedData = () => {
    // Filter to only show stocks in the selected index
    const stocksArray = Array.from(marketData.values()).filter(s => indexSymbols.includes(s.symbol));

    if (sortConfig.key) {
      stocksArray.sort((a, b) => {
        let aValue = a[sortConfig.key as keyof Stock];
        let bValue = b[sortConfig.key as keyof Stock];

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return stocksArray;
  };

  const getSortIcon = (columnKey: string) => {
    if (sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
  };

  // Calculate index summary from current data
  const calculateIndexSummary = (): IndexSummary | null => {
    const stocks = Array.from(marketData.values()).filter(s => indexSymbols.includes(s.symbol));
    if (stocks.length === 0) return null;

    const totalVolume = stocks.reduce((sum, s) => sum + (s.volume || 0), 0);
    const changes = stocks.map((s) => s.change_percent).filter((c) => c !== null && c !== undefined);
    const avgChange = changes.length > 0 ? changes.reduce((a, b) => a + b, 0) / changes.length : 0;
    const stocksUp = stocks.filter((s) => (s.change || 0) > 0).length;
    const stocksDown = stocks.filter((s) => (s.change || 0) < 0).length;

    return {
      total_volume: totalVolume,
      avg_change_percent: Math.round(avgChange * 100) / 100,
      stocks_up: stocksUp,
      stocks_down: stocksDown,
      stocks_unchanged: stocks.length - stocksUp - stocksDown,
      total_stocks: stocks.length,
    };
  };

  const currentSummary = calculateIndexSummary() || indexSummary;

  // Pagination
  const sortedData = getSortedData();
  const totalPages = Math.ceil(sortedData.length / STOCKS_PER_PAGE);
  const paginatedData = sortedData.slice(
    (currentPage - 1) * STOCKS_PER_PAGE,
    currentPage * STOCKS_PER_PAGE
  );

  if (loading) {
    return <LoadingSpinner message="Loading market data..." />;
  }

  if (error && marketData.size === 0) {
    return (
      <div className="text-center py-12">
        <div className="mb-6">
          <svg
            className="mx-auto h-16 w-16 text-red-500 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="text-xl font-semibold text-white mb-2">Unable to Load Market Data</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            We couldn&apos;t fetch market data. Please try again.
          </p>
        </div>
        <button
          onClick={() => fetchInitialData()}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <h2 className="text-3xl font-bold text-white">Market Dashboard</h2>

          <div className="flex items-center gap-4">
            {/* Index Selector */}
            <select
              value={selectedIndex}
              onChange={(e) => setSelectedIndex(e.target.value as IndexType)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="KMI30">KMI-30 (Top 30)</option>
              <option value="KMIALLSHR">KMI All Shares ({KMI_ALL_SHARES_STOCKS.length})</option>
            </select>

            {/* WebSocket Status */}
            <div
              className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                isConnected
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                  : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
              {isConnected ? 'LIVE' : 'Polling'}
            </div>

            {/* Market Status */}
            <div
              className={`px-3 py-1 rounded-full text-sm font-semibold ${
                marketStatus.open
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                  : 'bg-red-500/20 text-red-400 border border-red-500/50'
              }`}
            >
              {marketStatus.message}
            </div>

            <button
              onClick={handleManualRefresh}
              className="px-4 py-3 rounded-lg font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-3 text-sm text-gray-400">
          {lastUpdated && (
            <div className="flex items-center gap-2">
              <span>Last tick: {lastUpdated.toLocaleTimeString()}</span>
              <StaleDataWarning isStale={isStale} lastUpdated={lastUpdated} />
            </div>
          )}

          {isConnected && (
            <>
              <span className="hidden sm:inline">•</span>
              <span className="text-green-400">
                Real-time streaming active ({tickCount} ticks)
              </span>
            </>
          )}

          {wsError && (
            <>
              <span className="hidden sm:inline">•</span>
              <span className="text-yellow-400">
                {wsError}{' '}
                <button onClick={reconnect} className="underline hover:text-yellow-300">
                  Reconnect
                </button>
              </span>
            </>
          )}

          <span className="hidden sm:inline">•</span>
          <span className="text-gray-400">
            Showing {paginatedData.length} of {sortedData.length} stocks
          </span>
        </div>
      </div>

      {currentSummary && (
        <div className="mb-6 bg-gray-800 rounded-lg shadow p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-400 mb-2">
                {selectedIndex === 'KMI30' ? 'KMI-30' : 'KMI All Shares'} Performance
              </h3>
              <div className="flex items-baseline gap-3">
                <span
                  className={`text-3xl font-bold ${
                    currentSummary.avg_change_percent > 0
                      ? 'text-green-500'
                      : currentSummary.avg_change_percent < 0
                      ? 'text-red-500'
                      : 'text-gray-400'
                  }`}
                >
                  {currentSummary.avg_change_percent > 0 ? '+' : ''}
                  {currentSummary.avg_change_percent.toFixed(2)}%
                </span>
                <span className="text-sm text-gray-400">
                  {currentSummary.stocks_up} up, {currentSummary.stocks_down} down
                </span>
              </div>
            </div>

            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Total Volume</h3>
              <div className="text-3xl font-bold text-white">
                {formatNumber(currentSummary.total_volume)}
              </div>
            </div>

            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Market Breadth</h3>
              <div className="flex gap-2 items-center">
                <div className="flex-1 bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div className="flex h-full">
                    <div
                      className="bg-green-500"
                      style={{
                        width: `${(currentSummary.stocks_up / currentSummary.total_stocks) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-red-500"
                      style={{
                        width: `${(currentSummary.stocks_down / currentSummary.total_stocks) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <span className="text-sm text-gray-400 whitespace-nowrap">
                  {currentSummary.total_stocks} stocks
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-800 rounded-lg shadow overflow-x-auto">
        <table className="w-full divide-y divide-gray-700">
          <thead className="bg-gray-900">
            <tr>
              {[
                { key: 'symbol', label: 'Symbol', align: 'left' },
                { key: 'current', label: 'Price', align: 'right' },
                { key: 'change', label: 'Change', align: 'right' },
                { key: 'change_percent', label: 'Change %', align: 'right' },
                { key: 'volume', label: 'Volume', align: 'right' },
                { key: 'high', label: 'High', align: 'right' },
                { key: 'low', label: 'Low', align: 'right' },
                { key: 'ldcp', label: 'LDCP', align: 'right' },
              ].map(({ key, label, align }) => (
                <th
                  key={key}
                  className={`px-4 py-3 text-${align} text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-800 transition-colors`}
                  onClick={() => handleSort(key)}
                >
                  {label}
                  {getSortIcon(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-4 text-center text-gray-400">
                  No market data available
                </td>
              </tr>
            ) : (
              paginatedData.map((stock) => {
                const isExpanded = expandedSymbol === stock.symbol;
                const isInPortfolio = portfolioSymbols.includes(stock.symbol);

                return (
                  <React.Fragment key={stock.symbol}>
                    <tr
                      className="hover:bg-gray-700 transition-colors cursor-pointer"
                      onClick={() => handleRowClick(stock.symbol)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">
                        <div className="flex items-center gap-2">
                          <span>{isExpanded ? '▼' : '▶'}</span>
                          <div>
                            <div className="font-semibold">{stock.symbol}</div>
                            <div className="text-xs text-gray-400 truncate max-w-[200px]">{stock.name}</div>
                          </div>
                        </div>
                      </td>
                      <td
                        className={`px-4 py-3 whitespace-nowrap text-sm text-right font-semibold ${getPriceColor(stock.current, stock.ldcp)}`}
                      >
                        {formatPKR(stock.current)}
                      </td>
                      <td
                        className={`px-4 py-3 whitespace-nowrap text-sm text-right ${stock.change >= 0 ? 'text-green-500' : 'text-red-500'}`}
                      >
                        {formatPKR(stock.change)}
                      </td>
                      <td
                        className={`px-4 py-3 whitespace-nowrap text-sm text-right ${stock.change_percent >= 0 ? 'text-green-500' : 'text-red-500'}`}
                      >
                        {formatPercent(stock.change_percent)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-300">
                        {formatNumber(stock.volume)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-300">
                        {formatPKR(stock.high)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-300">
                        {formatPKR(stock.low)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-300">
                        {formatPKR(stock.ldcp)}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-750">
                        <td colSpan={8} className="px-6 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* 52-Week Range */}
                            <div>
                              <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">52-Week Range</h4>
                              {stock.week_52_high && stock.week_52_low ? (
                                <div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-300">Low: {formatPKR(stock.week_52_low)}</span>
                                    <span className="text-gray-300">High: {formatPKR(stock.week_52_high)}</span>
                                  </div>
                                  <div className="w-full bg-gray-600 rounded-full h-2 overflow-hidden">
                                    <div
                                      className="bg-blue-500 h-2 rounded-full"
                                      style={{
                                        width: `${((stock.current - stock.week_52_low) / (stock.week_52_high - stock.week_52_low)) * 100}%`,
                                      }}
                                    />
                                  </div>
                                  <div className="text-xs text-gray-400 mt-1">Current: {formatPKR(stock.current)}</div>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500">Data unavailable</p>
                              )}
                            </div>

                            {/* Day Range */}
                            <div>
                              <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Today&apos;s Range</h4>
                              <div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="text-gray-300">Low: {formatPKR(stock.low)}</span>
                                  <span className="text-gray-300">High: {formatPKR(stock.high)}</span>
                                </div>
                                <div className="w-full bg-gray-600 rounded-full h-2 overflow-hidden">
                                  <div
                                    className="bg-green-500 h-2 rounded-full"
                                    style={{
                                      width:
                                        stock.high && stock.low && stock.high !== stock.low
                                          ? `${((stock.current - stock.low) / (stock.high - stock.low)) * 100}%`
                                          : '50%',
                                    }}
                                  />
                                </div>
                                <div className="text-xs text-gray-400 mt-1">Current: {formatPKR(stock.current)}</div>
                              </div>
                            </div>

                            {/* Volume */}
                            <div>
                              <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Volume</h4>
                              <div className="text-sm text-gray-300 mb-1">Today: {formatNumber(stock.volume)}</div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-3 mt-4 pt-4 border-t border-gray-700">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewDetails(stock.symbol);
                              }}
                              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                              View Full Details
                            </button>
                            {!isInPortfolio && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddToPortfolio(stock.symbol);
                                }}
                                className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                              >
                                Add to Portfolio
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-2">
          <div className="text-sm text-gray-400">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
