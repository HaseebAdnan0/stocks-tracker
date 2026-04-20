'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  name: string | null;
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
  total_sold_quantity?: number;
  total_sold_value?: number;
  avg_sell_price?: number | null;
}

interface WhatIfEntry {
  total_shares: number;
  total_invested: number;
  current_value: number;
  profit_loss: number;
  unrealized_pl: number;
  realized_pl: number;
  total_pl: number;
}

interface Summary {
  total_investment: number;
  total_current_value: number;
  total_pnl: number;
  total_pnl_percent: number;
  realized_pl: number;
  unrealized_pl: number;
  total_pl: number;
  account_balance: number;
  currently_invested: number;
  cash_available: number;
  portfolio_value: number;
  best_performer: { symbol: string; pnl_percent: number } | null;
  worst_performer: { symbol: string; pnl_percent: number } | null;
  what_if: {
    actual: WhatIfEntry;
    '10x': WhatIfEntry;
    '100x': WhatIfEntry;
  };
}

interface AccountTransaction {
  id: number;
  type: 'deposit' | 'withdraw';
  amount: number;
  notes: string | null;
  date: string;
  created_at: string;
}

type SortDir = 'asc' | 'desc';
type ActiveSortKey = 'symbol' | 'quantity' | 'buy_price' | 'current_price' | 'change_percent' | 'investment' | 'current_value' | 'pnl';
type ArchivedSortKey = 'symbol' | 'quantity' | 'buy_price' | 'avg_sell_price' | 'investment' | 'total_sold_value' | 'pnl';

interface HoldingGroup {
  key: string;
  symbol: string;
  name: string | null;
  isArchived: boolean;
  holdings: Holding[];
  totalQty: number;
  avgBuyPrice: number;
  totalInvestment: number;
  totalCurrentValue: number | null;
  totalPnL: number | null;
  currentPrice: number | null;
  changePercent: number | null;
  indices: string[];
  totalRealizedPl: number | null;
  totalSoldQty: number;
  totalSoldValue: number;
  avgSellPrice: number | null;
}

function groupHoldings(holdings: Holding[]): HoldingGroup[] {
  const groupMap = new Map<string, Holding[]>();
  for (const h of holdings) {
    const isArchived = h.quantity === 0;
    const key = `${h.symbol}-${isArchived ? 'archived' : 'active'}`;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(h);
  }

  const groups: HoldingGroup[] = [];
  for (const [key, lots] of groupMap) {
    const isArchived = lots[0].quantity === 0;
    const totalQty = lots.reduce((sum, h) => sum + h.quantity, 0);
    const totalSoldQty = lots.reduce((sum, h) => sum + (h.total_sold_quantity ?? 0), 0);
    const totalSoldValue = lots.reduce((sum, h) => sum + (h.total_sold_value ?? 0), 0);
    // Use total_sold_quantity for the per-share buy average when archived.
    const totalInvestment = lots.reduce((sum, h) => sum + h.investment, 0);
    const divisorForAvg = isArchived ? totalSoldQty : totalQty;
    const avgBuyPrice = divisorForAvg > 0 ? totalInvestment / divisorForAvg : totalInvestment / lots.length;
    const totalCurrentValue = isArchived ? null : lots.reduce((sum, h) => sum + (h.current_value ?? 0), 0);
    const totalPnL = isArchived
      ? lots.reduce((sum, h) => sum + (h.realized_pl ?? 0), 0)
      : lots.reduce((sum, h) => sum + (h.pnl ?? 0), 0);
    const currentPrice = lots[0].current_price;
    const changePercent = !isArchived && avgBuyPrice > 0 && currentPrice !== null
      ? ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100
      : null;
    const totalRealizedPl = isArchived ? lots.reduce((sum, h) => sum + (h.realized_pl ?? 0), 0) : null;
    const avgSellPrice = totalSoldQty > 0 ? totalSoldValue / totalSoldQty : null;

    groups.push({
      key,
      symbol: lots[0].symbol,
      name: lots[0].name,
      isArchived,
      holdings: lots,
      totalQty,
      avgBuyPrice,
      totalInvestment,
      totalCurrentValue,
      totalPnL,
      currentPrice,
      changePercent,
      indices: lots[0].indices,
      totalRealizedPl,
      totalSoldQty,
      totalSoldValue,
      avgSellPrice,
    });
  }
  return groups;
}

function compareNullable(a: number | null | undefined, b: number | null | undefined, dir: SortDir): number {
  const aNull = a === null || a === undefined;
  const bNull = b === null || b === undefined;
  if (aNull && bNull) return 0;
  if (aNull) return 1; // nulls always last
  if (bNull) return -1;
  return dir === 'asc' ? (a as number) - (b as number) : (b as number) - (a as number);
}

function PortfolioContent() {
  const [activeHoldings, setActiveHoldings] = useState<Holding[]>([]);
  const [archivedHoldings, setArchivedHoldings] = useState<Holding[]>([]);
  const [archivedLoaded, setArchivedLoaded] = useState(false);
  const [archivedLoading, setArchivedLoading] = useState(false);
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

  const [activeSectionOpen, setActiveSectionOpen] = useState(true);
  const [archivedSectionOpen, setArchivedSectionOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [activeSearch, setActiveSearch] = useState('');
  const [archivedSearch, setArchivedSearch] = useState('');
  const [activeSort, setActiveSort] = useState<{ key: ActiveSortKey; direction: SortDir }>({ key: 'symbol', direction: 'asc' });
  const [archivedSort, setArchivedSort] = useState<{ key: ArchivedSortKey; direction: SortDir }>({ key: 'symbol', direction: 'asc' });

  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [balanceModalType, setBalanceModalType] = useState<'deposit' | 'withdraw'>('deposit');
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceNotes, setBalanceNotes] = useState('');
  const [balanceDate, setBalanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [balanceSubmitting, setBalanceSubmitting] = useState(false);
  const [accountTransactions, setAccountTransactions] = useState<AccountTransaction[]>([]);
  const [showAccountHistory, setShowAccountHistory] = useState(false);

  const fetchArchived = useCallback(async () => {
    setArchivedLoading(true);
    try {
      const res = await fetch('/api/portfolio?status=archived');
      if (!res.ok) throw new Error('Failed to fetch archived holdings');
      const json = await res.json();
      setArchivedHoldings(json.holdings || []);
      setArchivedLoaded(true);
    } catch (err) {
      console.error('Error fetching archived holdings:', err);
    } finally {
      setArchivedLoading(false);
    }
  }, []);

  const fetchActiveAndSummary = useCallback(async (showLoading = true, alsoArchivedIfLoaded = false) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);

      const [activeRes, summaryRes, accountRes] = await Promise.all([
        fetch('/api/portfolio?status=active'),
        fetch('/api/portfolio/summary'),
        fetch('/api/account/balance'),
      ]);

      if (!activeRes.ok || !summaryRes.ok) {
        throw new Error('Failed to fetch portfolio data');
      }

      const activeJson = await activeRes.json();
      const summaryJson = await summaryRes.json();

      setActiveHoldings(activeJson.holdings || []);
      setSummary(summaryJson);

      if (accountRes.ok) {
        const accountJson = await accountRes.json();
        setAccountTransactions(accountJson.transactions || []);
      }

      if (alsoArchivedIfLoaded && archivedLoaded) {
        await fetchArchived();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching portfolio:', err);
    } finally {
      setLoading(false);
    }
  }, [archivedLoaded, fetchArchived]);

  useEffect(() => {
    fetchActiveAndSummary();
    const interval = setInterval(() => {
      fetchActiveAndSummary(false);
    }, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lazy-load archived on first expand.
  useEffect(() => {
    if (archivedSectionOpen && !archivedLoaded && !archivedLoading) {
      fetchArchived();
    }
  }, [archivedSectionOpen, archivedLoaded, archivedLoading, fetchArchived]);

  // Actions that mutate holdings must invalidate both tables.
  const refreshAll = useCallback(async () => {
    await fetchActiveAndSummary(false, true);
  }, [fetchActiveAndSummary]);

  const getPnLColor = (pnl: number | null | undefined) => {
    if (pnl === null || pnl === undefined) return 'text-gray-400';
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

  const openBalanceModal = (type: 'deposit' | 'withdraw') => {
    setBalanceModalType(type);
    setBalanceAmount('');
    setBalanceNotes('');
    setBalanceDate(new Date().toISOString().split('T')[0]);
    setIsBalanceModalOpen(true);
  };

  const handleBalanceSubmit = async () => {
    const amount = parseFloat(balanceAmount);
    if (!amount || amount <= 0) return;
    setBalanceSubmitting(true);
    try {
      const response = await fetch('/api/account/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: balanceModalType,
          amount,
          notes: balanceNotes || null,
          date: balanceDate,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Failed to process transaction');
        return;
      }
      setIsBalanceModalOpen(false);
      await refreshAll();
    } catch (err) {
      console.error('Error processing balance transaction:', err);
      alert('Failed to process transaction');
    } finally {
      setBalanceSubmitting(false);
    }
  };

  const handleDeleteAccountTransaction = async (id: number) => {
    try {
      const response = await fetch(`/api/account/balance?id=${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      await refreshAll();
    } catch (err) {
      console.error('Error deleting account transaction:', err);
      alert('Failed to delete transaction');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingHolding) return;
    try {
      const response = await fetch(`/api/portfolio/${deletingHolding.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete holding');
      setIsDeleteModalOpen(false);
      setDeletingHolding(null);
      await refreshAll();
    } catch (err) {
      console.error('Error deleting holding:', err);
      alert('Failed to delete holding. Please try again.');
    }
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Filter groups based on search (symbol or full name, case-insensitive).
  const filterGroups = (groups: HoldingGroup[], q: string): HoldingGroup[] => {
    const query = q.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter((g) => {
      if (g.symbol.toLowerCase().includes(query)) return true;
      if (g.name && g.name.toLowerCase().includes(query)) return true;
      return false;
    });
  };

  const sortActiveGroups = (groups: HoldingGroup[]): HoldingGroup[] => {
    const { key, direction } = activeSort;
    const arr = [...groups];
    arr.sort((a, b) => {
      if (key === 'symbol') {
        const cmp = a.symbol.localeCompare(b.symbol);
        return direction === 'asc' ? cmp : -cmp;
      }
      const mapVal = (g: HoldingGroup): number | null => {
        switch (key) {
          case 'quantity': return g.totalQty;
          case 'buy_price': return g.avgBuyPrice;
          case 'current_price': return g.currentPrice;
          case 'change_percent': return g.changePercent;
          case 'investment': return g.totalInvestment;
          case 'current_value': return g.totalCurrentValue;
          case 'pnl': return g.totalPnL;
        }
      };
      return compareNullable(mapVal(a), mapVal(b), direction);
    });
    return arr;
  };

  const sortArchivedGroups = (groups: HoldingGroup[]): HoldingGroup[] => {
    const { key, direction } = archivedSort;
    const arr = [...groups];
    arr.sort((a, b) => {
      if (key === 'symbol') {
        const cmp = a.symbol.localeCompare(b.symbol);
        return direction === 'asc' ? cmp : -cmp;
      }
      const mapVal = (g: HoldingGroup): number | null => {
        switch (key) {
          case 'quantity': return g.totalSoldQty;
          case 'buy_price': return g.avgBuyPrice;
          case 'avg_sell_price': return g.avgSellPrice;
          case 'investment': return g.totalInvestment;
          case 'total_sold_value': return g.totalSoldValue;
          case 'pnl': return g.totalRealizedPl;
        }
      };
      return compareNullable(mapVal(a), mapVal(b), direction);
    });
    return arr;
  };

  const activeGroups = useMemo(
    () => sortActiveGroups(filterGroups(groupHoldings(activeHoldings), activeSearch)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeHoldings, activeSearch, activeSort]
  );
  const archivedGroups = useMemo(
    () => sortArchivedGroups(filterGroups(groupHoldings(archivedHoldings), archivedSearch)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [archivedHoldings, archivedSearch, archivedSort]
  );

  const toggleActiveSort = (key: ActiveSortKey) => {
    setActiveSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  const toggleArchivedSort = (key: ArchivedSortKey) => {
    setArchivedSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  if (loading) {
    return <LoadingSpinner message="Loading your portfolio..." />;
  }

  if (error && activeHoldings.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-white mb-2">Unable to Load Portfolio</h3>
          <p className="text-gray-400 mb-6">Please try again.</p>
        </div>
        <button
          onClick={() => fetchActiveAndSummary()}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const hasStaleData = activeHoldings.some((h) => h.current_price === null);
  const hasAnyHoldings = activeHoldings.length > 0 || archivedHoldings.length > 0 || archivedLoaded;

  const sortIndicator = (active: boolean, direction: SortDir) => {
    if (!active) return <span className="ml-1 text-gray-600">↕</span>;
    return <span className="ml-1 text-blue-400">{direction === 'asc' ? '▲' : '▼'}</span>;
  };

  const ActiveHeader = ({ label, sortKey, align = 'right' }: { label: string; sortKey: ActiveSortKey; align?: 'left' | 'right' | 'center' }) => (
    <th
      onClick={() => toggleActiveSort(sortKey)}
      className={`px-6 py-3 text-${align} text-xs font-medium text-gray-300 uppercase cursor-pointer select-none hover:bg-gray-800`}
    >
      {label}
      {sortIndicator(activeSort.key === sortKey, activeSort.direction)}
    </th>
  );

  const ArchivedHeader = ({ label, sortKey, align = 'right' }: { label: string; sortKey: ArchivedSortKey; align?: 'left' | 'right' | 'center' }) => (
    <th
      onClick={() => toggleArchivedSort(sortKey)}
      className={`px-6 py-3 text-${align} text-xs font-medium text-gray-300 uppercase cursor-pointer select-none hover:bg-gray-800`}
    >
      {label}
      {sortIndicator(archivedSort.key === sortKey, archivedSort.direction)}
    </th>
  );

  const renderActiveRow = (group: HoldingGroup) => {
    const isSingle = group.holdings.length === 1;
    const isExpanded = expandedGroups.has(group.key);
    const displayPnL = group.totalPnL;

    if (isSingle) {
      const holding = group.holdings[0];
      return (
        <tr key={holding.id} className="hover:bg-gray-700 transition-colors">
          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
            <div className="flex items-center gap-2">
              <span>{holding.symbol}</span>
              <ShariahBadge indices={holding.indices} size="xs" />
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">{formatNumber(holding.quantity)}</td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">{formatPKR(holding.buy_price)}</td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">{formatPKR(holding.current_price)}</td>
          <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${getPnLColor(holding.change_percent)}`}>{formatPercent(holding.change_percent)}</td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">{formatPKR(holding.investment)}</td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">{formatPKR(holding.current_value)}</td>
          <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${getPnLColor(holding.pnl)}`}>{formatPKR(holding.pnl)}</td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => handleEditClick(holding)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors">Edit</button>
              <button onClick={() => handleSellClick(holding)} className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors">Sell</button>
              <button onClick={() => handleDeleteClick(holding)} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors">Delete</button>
            </div>
          </td>
        </tr>
      );
    }

    return (
      <React.Fragment key={group.key}>
        <tr className="hover:bg-gray-700 transition-colors cursor-pointer" onClick={() => toggleGroup(group.key)}>
          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
            <div className="flex items-center gap-2">
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span>{group.symbol}</span>
              <ShariahBadge indices={group.indices} size="xs" />
              <span className="text-xs text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded">{group.holdings.length} lots</span>
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">{formatNumber(group.totalQty)}</td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">{formatPKR(group.avgBuyPrice)}</td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">{formatPKR(group.currentPrice)}</td>
          <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${getPnLColor(group.changePercent)}`}>{formatPercent(group.changePercent)}</td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">{formatPKR(group.totalInvestment)}</td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">{formatPKR(group.totalCurrentValue)}</td>
          <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${getPnLColor(displayPnL)}`}>{formatPKR(displayPnL)}</td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
            <span className="text-gray-500 text-xs">Expand for actions</span>
          </td>
        </tr>
        {isExpanded && group.holdings.map((holding) => (
          <tr key={holding.id} className="hover:bg-gray-700 transition-colors" style={{ backgroundColor: 'rgba(55, 65, 81, 0.5)' }}>
            <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-400">
              <div className="flex items-center gap-2 pl-6"><span className="text-gray-500">└</span><span>{holding.symbol}</span></div>
            </td>
            <td className="px-6 py-3 whitespace-nowrap text-sm text-right text-gray-400">{formatNumber(holding.quantity)}</td>
            <td className="px-6 py-3 whitespace-nowrap text-sm text-right text-gray-400">{formatPKR(holding.buy_price)}</td>
            <td className="px-6 py-3 whitespace-nowrap text-sm text-right text-gray-400">{formatPKR(holding.current_price)}</td>
            <td className={`px-6 py-3 whitespace-nowrap text-sm text-right ${getPnLColor(holding.change_percent)}`}>{formatPercent(holding.change_percent)}</td>
            <td className="px-6 py-3 whitespace-nowrap text-sm text-right text-gray-400">{formatPKR(holding.investment)}</td>
            <td className="px-6 py-3 whitespace-nowrap text-sm text-right text-gray-400">{formatPKR(holding.current_value)}</td>
            <td className={`px-6 py-3 whitespace-nowrap text-sm text-right font-semibold ${getPnLColor(holding.pnl)}`}>{formatPKR(holding.pnl)}</td>
            <td className="px-6 py-3 whitespace-nowrap text-sm text-center">
              <div className="flex items-center justify-center gap-2">
                <button onClick={() => handleEditClick(holding)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors">Edit</button>
                <button onClick={() => handleSellClick(holding)} className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors">Sell</button>
                <button onClick={() => handleDeleteClick(holding)} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors">Delete</button>
              </div>
            </td>
          </tr>
        ))}
      </React.Fragment>
    );
  };

  const renderArchivedRow = (group: HoldingGroup) => {
    const isSingle = group.holdings.length === 1;
    const isExpanded = expandedGroups.has(group.key);

    if (isSingle) {
      const holding = group.holdings[0];
      const soldQty = holding.total_sold_quantity ?? 0;
      const soldValue = holding.total_sold_value ?? 0;
      const sellPrice = holding.avg_sell_price ?? null;
      const investment = holding.buy_price * soldQty;
      const realized = holding.realized_pl ?? null;
      return (
        <tr key={holding.id} className="hover:bg-gray-700 transition-colors">
          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
            <div className="flex items-center gap-2">
              <span>{holding.symbol}</span>
              <ShariahBadge indices={holding.indices} size="xs" />
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">{formatNumber(soldQty)}</td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">{formatPKR(holding.buy_price)}</td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">{formatPKR(sellPrice)}</td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">{formatPKR(investment)}</td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">{formatPKR(soldValue)}</td>
          <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${getPnLColor(realized)}`}>{formatPKR(realized)}</td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => handleEditClick(holding)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors">Edit</button>
              <button onClick={() => handleDeleteClick(holding)} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors">Delete</button>
            </div>
          </td>
        </tr>
      );
    }

    return (
      <React.Fragment key={group.key}>
        <tr className="hover:bg-gray-700 transition-colors cursor-pointer" onClick={() => toggleGroup(group.key)}>
          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
            <div className="flex items-center gap-2">
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span>{group.symbol}</span>
              <ShariahBadge indices={group.indices} size="xs" />
              <span className="text-xs text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded">{group.holdings.length} lots</span>
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">{formatNumber(group.totalSoldQty)}</td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">{formatPKR(group.avgBuyPrice)}</td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">{formatPKR(group.avgSellPrice)}</td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">{formatPKR(group.totalInvestment)}</td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">{formatPKR(group.totalSoldValue)}</td>
          <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${getPnLColor(group.totalRealizedPl)}`}>{formatPKR(group.totalRealizedPl)}</td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
            <span className="text-gray-500 text-xs">Expand for actions</span>
          </td>
        </tr>
        {isExpanded && group.holdings.map((holding) => {
          const soldQty = holding.total_sold_quantity ?? 0;
          const soldValue = holding.total_sold_value ?? 0;
          const investment = holding.buy_price * soldQty;
          return (
            <tr key={holding.id} className="hover:bg-gray-700 transition-colors" style={{ backgroundColor: 'rgba(55, 65, 81, 0.5)' }}>
              <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-400">
                <div className="flex items-center gap-2 pl-6"><span className="text-gray-500">└</span><span>{holding.symbol}</span></div>
              </td>
              <td className="px-6 py-3 whitespace-nowrap text-sm text-right text-gray-400">{formatNumber(soldQty)}</td>
              <td className="px-6 py-3 whitespace-nowrap text-sm text-right text-gray-400">{formatPKR(holding.buy_price)}</td>
              <td className="px-6 py-3 whitespace-nowrap text-sm text-right text-gray-400">{formatPKR(holding.avg_sell_price ?? null)}</td>
              <td className="px-6 py-3 whitespace-nowrap text-sm text-right text-gray-400">{formatPKR(investment)}</td>
              <td className="px-6 py-3 whitespace-nowrap text-sm text-right text-gray-400">{formatPKR(soldValue)}</td>
              <td className={`px-6 py-3 whitespace-nowrap text-sm text-right font-semibold ${getPnLColor(holding.realized_pl ?? null)}`}>{formatPKR(holding.realized_pl ?? null)}</td>
              <td className="px-6 py-3 whitespace-nowrap text-sm text-center">
                <div className="flex items-center justify-center gap-2">
                  <button onClick={() => handleEditClick(holding)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors">Edit</button>
                  <button onClick={() => handleDeleteClick(holding)} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors">Delete</button>
                </div>
              </td>
            </tr>
          );
        })}
      </React.Fragment>
    );
  };

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

      {hasStaleData && (
        <div className="mb-6 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
          <svg className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <h4 className="text-yellow-500 font-semibold mb-1">Current Prices Unavailable</h4>
            <p className="text-gray-300 text-sm">We couldn&apos;t fetch current market prices for some holdings.</p>
          </div>
        </div>
      )}

      {summary && (
        <div className="space-y-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-5 shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Account Overview</h3>
              <div className="flex gap-2">
                <button onClick={() => openBalanceModal('deposit')} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded flex items-center gap-1 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Deposit
                </button>
                <button onClick={() => openBalanceModal('withdraw')} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded flex items-center gap-1 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                  Withdraw
                </button>
                <button onClick={() => setShowAccountHistory(!showAccountHistory)} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors">
                  {showAccountHistory ? 'Hide' : 'History'}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-gray-400 text-xs font-medium mb-1">Total Deposited</p>
                <p className="text-xl font-bold text-white">{formatPKR(summary.account_balance)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs font-medium mb-1">Currently Invested</p>
                <p className="text-xl font-bold text-blue-400">{formatPKR(summary.currently_invested)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs font-medium mb-1">Cash Available</p>
                <p className={`text-xl font-bold ${summary.cash_available >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPKR(summary.cash_available)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs font-medium mb-1">Portfolio Value</p>
                <p className="text-xl font-bold text-white">{formatPKR(summary.portfolio_value)}</p>
                <p className="text-xs text-gray-500 mt-0.5">Holdings + Cash</p>
              </div>
            </div>

            {showAccountHistory && accountTransactions.length > 0 && (
              <div className="mt-4 border-t border-gray-700 pt-4">
                <h4 className="text-sm font-medium text-gray-400 mb-2">Transaction History</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {accountTransactions.map((txn) => (
                    <div key={txn.id} className="flex items-center justify-between text-sm bg-gray-900 rounded px-3 py-2">
                      <div className="flex items-center gap-3">
                        <span className={`font-medium ${txn.type === 'deposit' ? 'text-green-400' : 'text-red-400'}`}>
                          {txn.type === 'deposit' ? '+' : '-'}{formatPKR(txn.amount)}
                        </span>
                        <span className="text-gray-500">{txn.date}</span>
                        {txn.notes && <span className="text-gray-500 text-xs">{txn.notes}</span>}
                      </div>
                      <button onClick={() => handleDeleteAccountTransaction(txn.id)} className="text-gray-500 hover:text-red-400 transition-colors" title="Delete transaction">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {showAccountHistory && accountTransactions.length === 0 && (
              <div className="mt-4 border-t border-gray-700 pt-4">
                <p className="text-sm text-gray-500">No transactions yet. Deposit funds to get started.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {summary && activeHoldings.length > 0 && (
        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-800 rounded-lg p-5 shadow">
              <h3 className="text-gray-400 text-sm font-medium mb-2">Total Investment</h3>
              <p className="text-2xl font-bold text-white">{formatPKR(summary.total_investment)}</p>
              <p className="text-xs text-gray-500 mt-1">Cost basis of active holdings</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-5 shadow">
              <h3 className="text-gray-400 text-sm font-medium mb-2">Current Value</h3>
              <p className="text-2xl font-bold text-white">{formatPKR(summary.total_current_value)}</p>
              <p className="text-xs text-gray-500 mt-1">Market value of active holdings</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`bg-gray-800 rounded-lg p-5 shadow ${summary.realized_pl >= 0 ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'}`}>
              <h3 className="text-gray-400 text-sm font-medium mb-2">Realized P&L</h3>
              <p className={`text-2xl font-bold ${getPnLColor(summary.realized_pl)}`}>{formatPKR(summary.realized_pl)}</p>
              <p className="text-xs text-gray-400 mt-1">From closed positions</p>
            </div>
            <div className={`bg-gray-800 rounded-lg p-5 shadow ${summary.unrealized_pl >= 0 ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'}`}>
              <h3 className="text-gray-400 text-sm font-medium mb-2">Unrealized P&L</h3>
              <p className={`text-2xl font-bold ${getPnLColor(summary.unrealized_pl)}`}>{formatPKR(summary.unrealized_pl)}</p>
              <p className="text-xs text-gray-400 mt-1">From active holdings</p>
            </div>
            <div className={`bg-gray-800 rounded-lg p-5 shadow ${summary.total_pl >= 0 ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'}`}>
              <h3 className="text-gray-400 text-sm font-medium mb-2">Total P&L</h3>
              <p className={`text-2xl font-bold ${getPnLColor(summary.total_pl)}`}>{formatPKR(summary.total_pl)}</p>
              <p className="text-xs text-gray-400 mt-1">Realized + Unrealized</p>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-5 shadow">
            <h3 className="text-gray-400 text-sm font-medium mb-3">Performance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {summary.best_performer && (
                <div>
                  <span className="text-xs text-gray-400">Best: </span>
                  <span className="text-sm font-semibold text-white">{summary.best_performer.symbol}</span>
                  <span className="text-sm font-semibold text-green-500 ml-2">{formatPercent(summary.best_performer.pnl_percent)}</span>
                </div>
              )}
              {summary.worst_performer && (
                <div>
                  <span className="text-xs text-gray-400">Worst: </span>
                  <span className="text-sm font-semibold text-white">{summary.worst_performer.symbol}</span>
                  <span className={`text-sm font-semibold ml-2 ${getPnLColor(summary.worst_performer.pnl_percent)}`}>{formatPercent(summary.worst_performer.pnl_percent)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!hasAnyHoldings ? (
        <div className="text-center py-12 bg-gray-800 rounded-lg">
          <p className="text-gray-400">No holdings in your portfolio yet.</p>
          <button onClick={() => setIsAddModalOpen(true)} className="mt-4 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded">
            Add Holding
          </button>
        </div>
      ) : (
        <>
          {/* Active holdings section (collapsible, open by default) */}
          <div className="bg-gray-800 rounded-lg shadow mb-6">
            <button
              onClick={() => setActiveSectionOpen((v) => !v)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-750 transition-colors"
            >
              <div className="flex items-center gap-3">
                <svg className={`w-5 h-5 text-gray-400 transition-transform ${activeSectionOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <h3 className="text-lg font-semibold text-white">Active Holdings</h3>
                <span className="text-sm text-gray-400">({activeHoldings.length})</span>
              </div>
            </button>

            {activeSectionOpen && (
              <div className="border-t border-gray-700">
                <div className="px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
                  <input
                    type="text"
                    value={activeSearch}
                    onChange={(e) => setActiveSearch(e.target.value)}
                    placeholder="Search active by symbol or company name…"
                    className="flex-1 min-w-[240px] px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {activeSearch && (
                    <span className="text-xs text-gray-500">{activeGroups.length} match{activeGroups.length === 1 ? '' : 'es'}</span>
                  )}
                </div>

                {activeHoldings.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">No active holdings. Add one to get started.</div>
                ) : activeGroups.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">No active holdings match your search.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-700">
                      <thead className="bg-gray-900">
                        <tr>
                          <ActiveHeader label="Symbol" sortKey="symbol" align="left" />
                          <ActiveHeader label="Qty" sortKey="quantity" />
                          <ActiveHeader label="Buy Price" sortKey="buy_price" />
                          <ActiveHeader label="Current Price" sortKey="current_price" />
                          <ActiveHeader label="Change %" sortKey="change_percent" />
                          <ActiveHeader label="Investment" sortKey="investment" />
                          <ActiveHeader label="Current Value" sortKey="current_value" />
                          <ActiveHeader label="P&L" sortKey="pnl" />
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {activeGroups.map(renderActiveRow)}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Archived holdings section (collapsible, closed by default, lazy-loaded) */}
          <div className="bg-gray-800 rounded-lg shadow mb-6">
            <button
              onClick={() => setArchivedSectionOpen((v) => !v)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-750 transition-colors"
            >
              <div className="flex items-center gap-3">
                <svg className={`w-5 h-5 text-gray-400 transition-transform ${archivedSectionOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <h3 className="text-lg font-semibold text-white">Archived Holdings</h3>
                <span className="text-sm text-gray-400">
                  {archivedLoaded ? `(${archivedHoldings.length})` : '(click to load)'}
                </span>
              </div>
            </button>

            {archivedSectionOpen && (
              <div className="border-t border-gray-700">
                {archivedLoading && !archivedLoaded ? (
                  <div className="py-8"><LoadingSpinner message="Loading archived holdings..." /></div>
                ) : !archivedLoaded ? (
                  <div className="text-center py-8 text-gray-400">Preparing…</div>
                ) : archivedHoldings.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">No archived holdings. Sold positions will appear here.</div>
                ) : (
                  <>
                    <div className="px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
                      <input
                        type="text"
                        value={archivedSearch}
                        onChange={(e) => setArchivedSearch(e.target.value)}
                        placeholder="Search archived by symbol or company name…"
                        className="flex-1 min-w-[240px] px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {archivedSearch && (
                        <span className="text-xs text-gray-500">{archivedGroups.length} match{archivedGroups.length === 1 ? '' : 'es'}</span>
                      )}
                    </div>

                    {archivedGroups.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">No archived holdings match your search.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-700">
                          <thead className="bg-gray-900">
                            <tr>
                              <ArchivedHeader label="Symbol" sortKey="symbol" align="left" />
                              <ArchivedHeader label="Qty" sortKey="quantity" />
                              <ArchivedHeader label="Buy Price" sortKey="buy_price" />
                              <ArchivedHeader label="Sell Price" sortKey="avg_sell_price" />
                              <ArchivedHeader label="Investment" sortKey="investment" />
                              <ArchivedHeader label="Value When Sold" sortKey="total_sold_value" />
                              <ArchivedHeader label="Realized P&L" sortKey="pnl" />
                              <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-gray-800 divide-y divide-gray-700">
                            {archivedGroups.map(renderArchivedRow)}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* What If Analysis */}
          {summary && summary.what_if && activeHoldings.length > 0 && (
            <div className="mt-8 bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-2xl font-bold text-white mb-4">What If Analysis</h3>
              <p className="text-gray-400 text-sm mb-6">
                Explore how your portfolio would perform with larger investments
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Metric</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Actual</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">10x</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">100x</th>
                    </tr>
                  </thead>
                  <tbody className="bg-gray-800 divide-y divide-gray-700">
                    <tr className="hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">Total Shares</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">{formatNumber(summary.what_if.actual.total_shares)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">{formatNumber(summary.what_if['10x'].total_shares)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">{formatNumber(summary.what_if['100x'].total_shares)}</td>
                    </tr>
                    <tr className="hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">Total Invested</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">{formatPKR(summary.what_if.actual.total_invested)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">{formatPKR(summary.what_if['10x'].total_invested)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">{formatPKR(summary.what_if['100x'].total_invested)}</td>
                    </tr>
                    <tr className="hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">Current Value</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">{formatPKR(summary.what_if.actual.current_value)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">{formatPKR(summary.what_if['10x'].current_value)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300">{formatPKR(summary.what_if['100x'].current_value)}</td>
                    </tr>
                    <tr className="hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">Unrealized P&L</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${getPnLColor(summary.what_if.actual.unrealized_pl)}`}>{formatPKR(summary.what_if.actual.unrealized_pl)}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${getPnLColor(summary.what_if['10x'].unrealized_pl)}`}>{formatPKR(summary.what_if['10x'].unrealized_pl)}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${getPnLColor(summary.what_if['100x'].unrealized_pl)}`}>{formatPKR(summary.what_if['100x'].unrealized_pl)}</td>
                    </tr>
                    <tr className="hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">Realized P&L</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${getPnLColor(summary.what_if.actual.realized_pl)}`}>{formatPKR(summary.what_if.actual.realized_pl)}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${getPnLColor(summary.what_if['10x'].realized_pl)}`}>{formatPKR(summary.what_if['10x'].realized_pl)}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${getPnLColor(summary.what_if['100x'].realized_pl)}`}>{formatPKR(summary.what_if['100x'].realized_pl)}</td>
                    </tr>
                    <tr className="hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">Total P&L</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${getPnLColor(summary.what_if.actual.total_pl)}`}>{formatPKR(summary.what_if.actual.total_pl)}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${getPnLColor(summary.what_if['10x'].total_pl)}`}>{formatPKR(summary.what_if['10x'].total_pl)}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${getPnLColor(summary.what_if['100x'].total_pl)}`}>{formatPKR(summary.what_if['100x'].total_pl)}</td>
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
        onSuccess={refreshAll}
      />

      <EditHoldingModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={refreshAll}
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
        onSuccess={refreshAll}
        holding={sellingHolding}
      />

      {isBalanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4">
              {balanceModalType === 'deposit' ? 'Deposit Funds' : 'Withdraw Funds'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Amount (PKR)</label>
                <input
                  type="number"
                  value={balanceAmount}
                  onChange={(e) => setBalanceAmount(e.target.value)}
                  placeholder="Enter amount"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Date</label>
                <input
                  type="date"
                  value={balanceDate}
                  onChange={(e) => setBalanceDate(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={balanceNotes}
                  onChange={(e) => setBalanceNotes(e.target.value)}
                  placeholder="e.g. Monthly deposit"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setIsBalanceModalOpen(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBalanceSubmit}
                disabled={balanceSubmitting || !balanceAmount || parseFloat(balanceAmount) <= 0}
                className={`flex-1 px-4 py-2 text-white rounded transition-colors ${
                  balanceModalType === 'deposit'
                    ? 'bg-green-600 hover:bg-green-700 disabled:bg-green-800'
                    : 'bg-red-600 hover:bg-red-700 disabled:bg-red-800'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {balanceSubmitting ? 'Processing...' : balanceModalType === 'deposit' ? 'Deposit' : 'Withdraw'}
              </button>
            </div>
          </div>
        </div>
      )}
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
