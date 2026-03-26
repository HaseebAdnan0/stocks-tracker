'use client';

import React, { useState, useEffect } from 'react';
import AuthGuard from '@/components/AuthGuard';
import LoadingSpinner from '@/components/LoadingSpinner';
import ShariahBadge from '@/components/ShariahBadge';
import AddHoldingModal from '@/components/AddHoldingModal';
import EditHoldingModal from '@/components/EditHoldingModal';
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';
import SellHoldingModal from '@/components/SellHoldingModal';
import { formatPKR, formatNumber, formatPercent } from '@/utils/formatters';

interface Holding {
  id: number;
  symbol: string;
  quantity: number;
  buy_price: number;
  buy_date: string;
  broker: string;
  notes: string | null;
  current_price: number | null;
  change: number | null;
  change_percent: number | null;
  investment: number;
  current_value: number | null;
  pnl: number | null;
  pnl_percent: number | null;
  indices: string[];
  status?: 'active' | 'sold';
  realized_pl?: number;
}

interface Summary {
  total_investment: number;
  total_current_value: number;
  total_pnl: number;
  total_pnl_percent: number;
  realized_pl: number;
  unrealized_pl: number;
  total_pl: number;
  best_performer: { symbol: string; pnl_percent: number } | null;
  worst_performer: { symbol: string; pnl_percent: number } | null;
  what_if: {
    actual: { total_shares: number; total_invested: number; current_value: number; profit_loss: number };
    '10x': { total_shares: number; total_invested: number; current_value: number; profit_loss: number };
    '100x': { total_shares: number; total_invested: number; current_value: number; profit_loss: number };
  };
}

type ViewMode = 'all' | 'active' | 'archived';

function PortfolioContent() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingHolding, setDeletingHolding] = useState<Holding | null>(null);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [sellingHolding, setSellingHolding] = useState<Holding | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchPortfolio();

    const interval = setInterval(() => {
      fetchPortfolio(false);
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const fetchPortfolio = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);

      const [holdingsResponse, summaryResponse] = await Promise.all([
        fetch('/api/portfolio'),
        fetch('/api/portfolio/summary'),
      ]);

      if (!holdingsResponse.ok || !summaryResponse.ok) {
        throw new Error('Failed to fetch portfolio data');
      }

      const holdingsResult = await holdingsResponse.json();
      const summaryResult = await summaryResponse.json();

      setHoldings(holdingsResult.holdings || []);
      setSummary(summaryResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching portfolio:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPnLColor = (pnl: number | null) => {
    if (pnl === null) return 'text-gray-400';
    if (pnl > 0) return 'text-green-500';
    if (pnl < 0) return 'text-red-500';
    return 'text-gray-400';
  };

  const handleEditClick = (holding: Holding) => {
    setEditingHolding(holding);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (holding: Holding) => {
    setDeletingHolding(holding);
    setIsDeleteModalOpen(true);
  };

  const handleSellClick = (holding: Holding) => {
    setSellingHolding(holding);
    setIsSellModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingHolding) return;

    try {
      const response = await fetch(`/api/portfolio/${deletingHolding.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete holding');
      }

      setIsDeleteModalOpen(false);
      setDeletingHolding(null);
      await fetchPortfolio();
    } catch (err) {
      console.error('Error deleting holding:', err);
      alert('Failed to delete holding. Please try again.');
    }
  };

  // Filter holdings based on view mode
  const activeHoldings = holdings.filter((h) => h.quantity > 0);
  const archivedHoldings = holdings.filter((h) => h.quantity === 0);

  // Sort: active holdings first (sorted by symbol), then archived (sorted by symbol)
  const sortedActiveHoldings = [...activeHoldings].sort((a, b) => a.symbol.localeCompare(b.symbol));
  const sortedArchivedHoldings = [...archivedHoldings].sort((a, b) => a.symbol.localeCompare(b.symbol));
  const allHoldingsSorted = [...sortedActiveHoldings, ...sortedArchivedHoldings];

  const displayedHoldings =
    viewMode === 'all'
      ? allHoldingsSorted
      : viewMode === 'active'
      ? sortedActiveHoldings
      : sortedArchivedHoldings;

  // Group holdings by symbol + archived status
  interface HoldingGroup {
    key: string;
    symbol: string;
    isArchived: boolean;
    holdings: Holding[];
    // Combined values
    totalQty: number;
    avgBuyPrice: number;
    totalInvestment: number;
    totalCurrentValue: number | null;
    totalPnL: number | null;
    currentPrice: number | null;
    changePercent: number | null;
    indices: string[];
    totalRealizedPl: number | null;
  }

  const groupedHoldings: HoldingGroup[] = (() => {
    const groupMap = new Map<string, Holding[]>();
    for (const h of displayedHoldings) {
      const isArchived = h.quantity === 0;
      const key = `${h.symbol}-${isArchived ? 'archived' : 'active'}`;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(h);
    }

    const groups: HoldingGroup[] = [];
    for (const [key, holdings] of groupMap) {
      const isArchived = holdings[0].quantity === 0;
      const totalQty = holdings.reduce((sum, h) => sum + h.quantity, 0);
      const totalInvestment = holdings.reduce((sum, h) => sum + h.investment, 0);
      const avgBuyPrice = totalQty > 0 ? totalInvestment / totalQty : totalInvestment / holdings.length;
      const totalCurrentValue = isArchived ? null : holdings.reduce((sum, h) => sum + (h.current_value ?? 0), 0);
      const totalPnL = isArchived
        ? holdings.reduce((sum, h) => sum + (h.realized_pl ?? 0), 0)
        : holdings.reduce((sum, h) => sum + (h.pnl ?? 0), 0);
      const currentPrice = holdings[0].current_price;
      const changePercent = !isArchived && avgBuyPrice > 0 && currentPrice !== null
        ? ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100
        : null;
      const totalRealizedPl = isArchived ? holdings.reduce((sum, h) => sum + (h.realized_pl ?? 0), 0) : null;

      groups.push({
        key,
        symbol: holdings[0].symbol,
        isArchived,
        holdings,
        totalQty,
        avgBuyPrice,
        totalInvestment,
        totalCurrentValue,
        totalPnL,
        currentPrice,
        changePercent,
        indices: holdings[0].indices,
        totalRealizedPl,
      });
    }
    return groups;
  })();

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (loading) {
    return <LoadingSpinner message="Loading your portfolio..." />;
  }

  if (error && holdings.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-white mb-2">Unable to Load Portfolio</h3>
          <p className="text-gray-400 mb-6">Please try again.</p>
        </div>
        <button
          onClick={() => fetchPortfolio()}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const hasStaleData = activeHoldings.some((h) => h.current_price === null);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold text-white">My Portfolio</h2>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-2 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Holding
        </button>
      </div>

      {hasStaleData && viewMode !== 'archived' && (
        <div className="mb-6 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
          <svg className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <h4 className="text-yellow-500 font-semibold mb-1">Current Prices Unavailable</h4>
            <p className="text-gray-300 text-sm">
              We couldn&apos;t fetch current market prices for some holdings.
            </p>
          </div>
        </div>
      )}

      {summary && activeHoldings.length > 0 && (
        <div className="space-y-4 mb-6">
          {/* First row: Investment and Current Value */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-800 rounded-lg p-5 shadow">
              <h3 className="text-gray-400 text-sm font-medium mb-2">Total Investment</h3>
              <p className="text-2xl font-bold text-white">{formatPKR(summary.total_investment)}</p>
            </div>

            <div className="bg-gray-800 rounded-lg p-5 shadow">
              <h3 className="text-gray-400 text-sm font-medium mb-2">Current Value</h3>
              <p className="text-2xl font-bold text-white">{formatPKR(summary.total_current_value)}</p>
            </div>
          </div>

          {/* Second row: P/L metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              className={`bg-gray-800 rounded-lg p-5 shadow ${summary.realized_pl >= 0 ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'}`}
            >
              <h3 className="text-gray-400 text-sm font-medium mb-2">Realized P&L</h3>
              <p className={`text-2xl font-bold ${getPnLColor(summary.realized_pl)}`}>
                {formatPKR(summary.realized_pl)}
              </p>
              <p className="text-xs text-gray-400 mt-1">From closed positions</p>
            </div>

            <div
              className={`bg-gray-800 rounded-lg p-5 shadow ${summary.unrealized_pl >= 0 ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'}`}
            >
              <h3 className="text-gray-400 text-sm font-medium mb-2">Unrealized P&L</h3>
              <p className={`text-2xl font-bold ${getPnLColor(summary.unrealized_pl)}`}>
                {formatPKR(summary.unrealized_pl)}
              </p>
              <p className="text-xs text-gray-400 mt-1">From active holdings</p>
            </div>

            <div
              className={`bg-gray-800 rounded-lg p-5 shadow ${summary.total_pl >= 0 ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'}`}
            >
              <h3 className="text-gray-400 text-sm font-medium mb-2">Total P&L</h3>
              <p className={`text-2xl font-bold ${getPnLColor(summary.total_pl)}`}>
                {formatPKR(summary.total_pl)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Realized + Unrealized</p>
            </div>
          </div>

          {/* Third row: Performance */}
          <div className="bg-gray-800 rounded-lg p-5 shadow">
            <h3 className="text-gray-400 text-sm font-medium mb-3">Performance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {summary.best_performer && (
                <div>
                  <span className="text-xs text-gray-400">Best: </span>
                  <span className="text-sm font-semibold text-white">{summary.best_performer.symbol}</span>
                  <span className="text-sm font-semibold text-green-500 ml-2">
                    {formatPercent(summary.best_performer.pnl_percent)}
                  </span>
                </div>
              )}
              {summary.worst_performer && (
                <div>
                  <span className="text-xs text-gray-400">Worst: </span>
                  <span className="text-sm font-semibold text-white">{summary.worst_performer.symbol}</span>
                  <span className={`text-sm font-semibold ml-2 ${getPnLColor(summary.worst_performer.pnl_percent)}`}>
                    {formatPercent(summary.worst_performer.pnl_percent)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {holdings.length === 0 ? (
        <div className="text-center py-12 bg-gray-800 rounded-lg">
          <p className="text-gray-400">No holdings in your portfolio yet.</p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="mt-4 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            Add Holding
          </button>
        </div>
      ) : (
        <>
          {/* View Mode Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setViewMode('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              All ({holdings.length})
            </button>
            <button
              onClick={() => setViewMode('active')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'active'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Active ({activeHoldings.length})
            </button>
            <button
              onClick={() => setViewMode('archived')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'archived'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Archived ({archivedHoldings.length})
            </button>
          </div>

          {displayedHoldings.length === 0 ? (
            <div className="text-center py-12 bg-gray-800 rounded-lg">
              <p className="text-gray-400">
                {viewMode === 'all'
                  ? 'No holdings yet. Add your first holding to get started.'
                  : viewMode === 'active'
                  ? 'No active holdings. Add a new holding or check archived.'
                  : 'No archived holdings. Sold positions will appear here.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto bg-gray-800 rounded-lg shadow">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Symbol</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase">Qty</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase">Buy Price</th>
                    {viewMode !== 'archived' && (
                      <>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase">Current Price</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase">Change %</th>
                      </>
                    )}
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase">Investment</th>
                    {viewMode !== 'archived' && (
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase">Current Value</th>
                    )}
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase">
                      {viewMode === 'archived' ? 'Realized P&L' : 'P&L'}
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {groupedHoldings.map((group) => {
                    const isSingle = group.holdings.length === 1;
                    const isExpanded = expandedGroups.has(group.key);

                    if (isSingle) {
                      // Single holding - render as normal row
                      const holding = group.holdings[0];
                      const isArchived = holding.quantity === 0;
                      const displayPnL = isArchived ? (holding.realized_pl ?? null) : holding.pnl;

                      return (
                        <tr key={holding.id} className="hover:bg-gray-700 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                            <div className="flex items-center gap-2">
                              <span>{holding.symbol}</span>
                              <ShariahBadge indices={holding.indices} size="xs" />
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">
                            {isArchived ? (
                              <span className="text-gray-500">SOLD</span>
                            ) : (
                              formatNumber(holding.quantity)
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">
                            {formatPKR(holding.buy_price)}
                          </td>
                          {viewMode !== 'archived' && (
                            <>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">
                                {isArchived ? '—' : formatPKR(holding.current_price)}
                              </td>
                              <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${isArchived ? 'text-gray-500' : getPnLColor(holding.change_percent)}`}>
                                {isArchived ? '—' : formatPercent(holding.change_percent)}
                              </td>
                            </>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">
                            {formatPKR(holding.investment)}
                          </td>
                          {viewMode !== 'archived' && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">
                              {isArchived ? '—' : formatPKR(holding.current_value)}
                            </td>
                          )}
                          <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${getPnLColor(displayPnL)}`}>
                            {formatPKR(displayPnL)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEditClick(holding)}
                                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                              >
                                Edit
                              </button>
                              {!isArchived && (
                                <button
                                  onClick={() => handleSellClick(holding)}
                                  className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors"
                                >
                                  Sell
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteClick(holding)}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    // Multi-holding group - render summary row + expandable children
                    const displayPnL = group.isArchived ? group.totalRealizedPl : group.totalPnL;

                    return (
                      <React.Fragment key={group.key}>
                        {/* Summary row (collapsed) */}
                        <tr
                          className="hover:bg-gray-700 transition-colors cursor-pointer"
                          onClick={() => toggleGroup(group.key)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                            <div className="flex items-center gap-2">
                              <svg
                                className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              <span>{group.symbol}</span>
                              <ShariahBadge indices={group.indices} size="xs" />
                              <span className="text-xs text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded">
                                {group.holdings.length} lots
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">
                            {group.isArchived ? (
                              <span className="text-gray-500">SOLD</span>
                            ) : (
                              formatNumber(group.totalQty)
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">
                            {formatPKR(group.avgBuyPrice)}
                          </td>
                          {viewMode !== 'archived' && (
                            <>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">
                                {group.isArchived ? '—' : formatPKR(group.currentPrice)}
                              </td>
                              <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${group.isArchived ? 'text-gray-500' : getPnLColor(group.changePercent)}`}>
                                {group.isArchived ? '—' : formatPercent(group.changePercent)}
                              </td>
                            </>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">
                            {formatPKR(group.totalInvestment)}
                          </td>
                          {viewMode !== 'archived' && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">
                              {group.isArchived ? '—' : formatPKR(group.totalCurrentValue)}
                            </td>
                          )}
                          <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${getPnLColor(displayPnL)}`}>
                            {formatPKR(displayPnL)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                            <span className="text-gray-500 text-xs">Expand for actions</span>
                          </td>
                        </tr>

                        {/* Expanded child rows */}
                        {isExpanded && group.holdings.map((holding) => {
                          const isArchived = holding.quantity === 0;
                          const childPnL = isArchived ? (holding.realized_pl ?? null) : holding.pnl;

                          return (
                            <tr key={holding.id} className="bg-gray-750 hover:bg-gray-700 transition-colors" style={{ backgroundColor: 'rgba(55, 65, 81, 0.5)' }}>
                              <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-400">
                                <div className="flex items-center gap-2 pl-6">
                                  <span className="text-gray-500">└</span>
                                  <span>{holding.symbol}</span>
                                </div>
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm text-right text-gray-400">
                                {isArchived ? (
                                  <span className="text-gray-500">SOLD</span>
                                ) : (
                                  formatNumber(holding.quantity)
                                )}
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm text-right text-gray-400">
                                {formatPKR(holding.buy_price)}
                              </td>
                              {viewMode !== 'archived' && (
                                <>
                                  <td className="px-6 py-3 whitespace-nowrap text-sm text-right text-gray-400">
                                    {isArchived ? '—' : formatPKR(holding.current_price)}
                                  </td>
                                  <td className={`px-6 py-3 whitespace-nowrap text-sm text-right ${isArchived ? 'text-gray-500' : getPnLColor(holding.change_percent)}`}>
                                    {isArchived ? '—' : formatPercent(holding.change_percent)}
                                  </td>
                                </>
                              )}
                              <td className="px-6 py-3 whitespace-nowrap text-sm text-right text-gray-400">
                                {formatPKR(holding.investment)}
                              </td>
                              {viewMode !== 'archived' && (
                                <td className="px-6 py-3 whitespace-nowrap text-sm text-right text-gray-400">
                                  {isArchived ? '—' : formatPKR(holding.current_value)}
                                </td>
                              )}
                              <td className={`px-6 py-3 whitespace-nowrap text-sm text-right font-semibold ${getPnLColor(childPnL)}`}>
                                {formatPKR(childPnL)}
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => handleEditClick(holding)}
                                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                                  >
                                    Edit
                                  </button>
                                  {!isArchived && (
                                    <button
                                      onClick={() => handleSellClick(holding)}
                                      className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors"
                                    >
                                      Sell
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteClick(holding)}
                                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* What If Analysis Section - Show for all and active views */}
          {viewMode !== 'archived' && summary && summary.what_if && activeHoldings.length > 0 && (
            <div className="mt-8 bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-2xl font-bold text-white mb-4">What If Analysis</h3>
              <p className="text-gray-400 text-sm mb-6">
                Explore how your portfolio would perform with larger investments
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Metric
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Actual
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                        10x
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                        100x
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-gray-800 divide-y divide-gray-700">
                    <tr className="hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">Total Shares</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">
                        {formatNumber(summary.what_if.actual.total_shares)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">
                        {formatNumber(summary.what_if['10x'].total_shares)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">
                        {formatNumber(summary.what_if['100x'].total_shares)}
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">Total Invested</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">
                        {formatPKR(summary.what_if.actual.total_invested)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">
                        {formatPKR(summary.what_if['10x'].total_invested)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">
                        {formatPKR(summary.what_if['100x'].total_invested)}
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">Current Value</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">
                        {formatPKR(summary.what_if.actual.current_value)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">
                        {formatPKR(summary.what_if['10x'].current_value)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">
                        {formatPKR(summary.what_if['100x'].current_value)}
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">Profit/Loss</td>
                      <td
                        className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${getPnLColor(summary.what_if.actual.profit_loss)}`}
                      >
                        {formatPKR(summary.what_if.actual.profit_loss)}
                      </td>
                      <td
                        className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${getPnLColor(summary.what_if['10x'].profit_loss)}`}
                      >
                        {formatPKR(summary.what_if['10x'].profit_loss)}
                      </td>
                      <td
                        className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${getPnLColor(summary.what_if['100x'].profit_loss)}`}
                      >
                        {formatPKR(summary.what_if['100x'].profit_loss)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <AddHoldingModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchPortfolio}
      />

      <EditHoldingModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={fetchPortfolio}
        holding={editingHolding}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingHolding(null);
        }}
        onConfirm={handleDeleteConfirm}
        holding={deletingHolding}
      />

      <SellHoldingModal
        isOpen={isSellModalOpen}
        onClose={() => {
          setIsSellModalOpen(false);
          setSellingHolding(null);
        }}
        onSuccess={fetchPortfolio}
        holding={sellingHolding}
      />
    </div>
  );
}

export default function Portfolio() {
  return (
    <AuthGuard>
      <PortfolioContent />
    </AuthGuard>
  );
}
