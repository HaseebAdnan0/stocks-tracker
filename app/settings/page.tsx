'use client';

import { useState, useEffect } from 'react';
import AuthGuard from '@/components/AuthGuard';
import LoadingSpinner from '@/components/LoadingSpinner';

interface CacheStatus {
  market_watch: {
    last_updated: string | null;
    age_seconds: number | null;
    cache_duration: number;
  };
  eod_data: {
    total_cached_symbols: number;
    oldest_cache: string | null;
    cache_duration: number;
  };
  fundamentals: {
    total_cached_symbols: number;
    oldest_cache: string | null;
    cache_duration: number;
  };
}

interface TrackedSymbol {
  id: number;
  symbol: string;
  name: string | null;
  added_at: string;
}

function SettingsContent() {
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null);
  const [trackedSymbols, setTrackedSymbols] = useState<TrackedSymbol[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [clearMessage, setClearMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newSymbol, setNewSymbol] = useState('');
  const [addingSymbol, setAddingSymbol] = useState(false);
  const [symbolMessage, setSymbolMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const APP_VERSION = '2.0.0';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cacheRes, symbolsRes] = await Promise.all([
        fetch('/api/cache-status'),
        fetch('/api/tracked-symbols'),
      ]);

      if (cacheRes.ok) {
        const cacheData = await cacheRes.json();
        setCacheStatus(cacheData);
      }

      if (symbolsRes.ok) {
        const symbolsData = await symbolsRes.json();
        setTrackedSymbols(symbolsData.data || []);
      }
    } catch (error) {
      console.error('Error fetching settings data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSymbol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol.trim()) return;

    setAddingSymbol(true);
    setSymbolMessage(null);

    try {
      const response = await fetch('/api/tracked-symbols', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: newSymbol.toUpperCase().trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setSymbolMessage({ type: 'success', text: `Added ${newSymbol.toUpperCase()} to tracked symbols` });
        setNewSymbol('');
        await fetchData();
      } else {
        setSymbolMessage({ type: 'error', text: data.error || 'Failed to add symbol' });
      }
    } catch (error) {
      console.error('Error adding symbol:', error);
      setSymbolMessage({ type: 'error', text: 'Failed to add symbol' });
    } finally {
      setAddingSymbol(false);
    }
  };

  const handleRemoveSymbol = async (symbol: string) => {
    if (!window.confirm(`Remove ${symbol} from tracked symbols?`)) return;

    try {
      const response = await fetch(`/api/tracked-symbols?symbol=${symbol}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSymbolMessage({ type: 'success', text: `Removed ${symbol} from tracked symbols` });
        await fetchData();
      } else {
        const data = await response.json();
        setSymbolMessage({ type: 'error', text: data.error || 'Failed to remove symbol' });
      }
    } catch (error) {
      console.error('Error removing symbol:', error);
      setSymbolMessage({ type: 'error', text: 'Failed to remove symbol' });
    }
  };

  const handleClearCache = async () => {
    if (!window.confirm('Are you sure you want to clear all cached data?')) {
      return;
    }

    setClearing(true);
    setClearMessage(null);

    try {
      const response = await fetch('/api/cache-clear', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setClearMessage({
          type: 'success',
          text: `Cache cleared! Deleted ${data.deleted_counts.market_watch} market watch, ${data.deleted_counts.eod_data} EOD, and ${data.deleted_counts.fundamentals} fundamentals entries.`,
        });
        await fetchData();
      } else {
        setClearMessage({
          type: 'error',
          text: data.message || 'Failed to clear cache',
        });
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      setClearMessage({
        type: 'error',
        text: 'Failed to clear cache. Please try again.',
      });
    } finally {
      setClearing(false);
    }
  };

  const formatTimestamp = (isoString: string | null) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatAge = (seconds: number | null) => {
    if (seconds === null) return 'N/A';

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    return `${Math.floor(seconds / 86400)} days`;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div>
      <h2 className="text-3xl font-bold text-white mb-6">Settings</h2>

      <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-2">App Version</h3>
        <p className="text-gray-400">PSX Shariah Portfolio Tracker v{APP_VERSION}</p>
        <p className="text-sm text-gray-500 mt-1">Real-time data via PSX Terminal WebSocket</p>
      </div>

      {/* Tracked Symbols Management */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-4">Tracked Symbols</h3>
        <p className="text-gray-400 mb-4">
          Add or remove stock symbols to track. Real-time data will be streamed for these symbols during market hours.
        </p>

        {/* Add Symbol Form */}
        <form onSubmit={handleAddSymbol} className="flex gap-2 mb-4">
          <input
            type="text"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
            placeholder="Enter symbol (e.g., HUBC)"
            className="flex-1 px-4 py-2 bg-gray-900 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            maxLength={10}
          />
          <button
            type="submit"
            disabled={addingSymbol || !newSymbol.trim()}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded font-medium transition-colors"
          >
            {addingSymbol ? 'Adding...' : 'Add Symbol'}
          </button>
        </form>

        {symbolMessage && (
          <div
            className={`mb-4 p-3 rounded ${
              symbolMessage.type === 'success'
                ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                : 'bg-red-500/20 text-red-400 border border-red-500/50'
            }`}
          >
            {symbolMessage.text}
          </div>
        )}

        {/* Symbols List */}
        <div className="bg-gray-900 p-4 rounded border border-gray-700">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-gray-400">
              {trackedSymbols.length} symbols tracked
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {trackedSymbols.map((item) => (
              <span
                key={item.id}
                className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/50 rounded text-sm font-mono flex items-center gap-2 group"
              >
                {item.symbol}
                <button
                  onClick={() => handleRemoveSymbol(item.symbol)}
                  className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                  title={`Remove ${item.symbol}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <p className="mt-3 text-sm text-gray-500">
          Tip: You can add any PSX symbol. Common indices include KMI-30 (Shariah-compliant), KSE-100, and KSE-30.
        </p>
      </div>

      {/* Cache Status */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-4">Cache Status</h3>

        {cacheStatus && (
          <div className="space-y-4">
            <div className="bg-gray-900 p-4 rounded border border-gray-700">
              <h4 className="text-lg font-medium text-white mb-2">Market Watch Data</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Last Updated:</span>
                  <span className="text-white">{formatTimestamp(cacheStatus.market_watch.last_updated)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Age:</span>
                  <span className="text-white">{formatAge(cacheStatus.market_watch.age_seconds)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Cache Duration:</span>
                  <span className="text-white">{formatDuration(cacheStatus.market_watch.cache_duration)}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 p-4 rounded border border-gray-700">
              <h4 className="text-lg font-medium text-white mb-2">End-of-Day (EOD) Data</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Cached Symbols:</span>
                  <span className="text-white">{cacheStatus.eod_data.total_cached_symbols}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Oldest Cache:</span>
                  <span className="text-white">{formatTimestamp(cacheStatus.eod_data.oldest_cache)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Cache Duration:</span>
                  <span className="text-white">{formatDuration(cacheStatus.eod_data.cache_duration)}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 p-4 rounded border border-gray-700">
              <h4 className="text-lg font-medium text-white mb-2">Fundamentals Data</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Cached Symbols:</span>
                  <span className="text-white">{cacheStatus.fundamentals.total_cached_symbols}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Oldest Cache:</span>
                  <span className="text-white">{formatTimestamp(cacheStatus.fundamentals.oldest_cache)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Cache Duration:</span>
                  <span className="text-white">{formatDuration(cacheStatus.fundamentals.cache_duration)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={handleClearCache}
            disabled={clearing}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded font-medium transition-colors"
          >
            {clearing ? 'Clearing Cache...' : 'Clear All Cache'}
          </button>

          {clearMessage && (
            <div
              className={`mt-4 p-3 rounded ${
                clearMessage.type === 'success'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                  : 'bg-red-500/20 text-red-400 border border-red-500/50'
              }`}
            >
              {clearMessage.text}
            </div>
          )}

          <p className="mt-2 text-sm text-gray-400">
            Clearing cache will force the app to fetch fresh data from PSX servers.
          </p>
        </div>
      </div>

      {/* Data Sources */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-4">Data Sources</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <span className="w-3 h-3 rounded-full bg-green-500 mt-1"></span>
            <div>
              <p className="text-white font-medium">PSX Terminal WebSocket</p>
              <p className="text-gray-400">Real-time tick-by-tick streaming during market hours</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-3 h-3 rounded-full bg-blue-500 mt-1"></span>
            <div>
              <p className="text-white font-medium">PSX Terminal REST API</p>
              <p className="text-gray-400">Historical data, fundamentals, and dividends</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-3 h-3 rounded-full bg-yellow-500 mt-1"></span>
            <div>
              <p className="text-white font-medium">PSX Data Portal</p>
              <p className="text-gray-400">Fallback for bulk market data (5-min delay)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  return (
    <AuthGuard>
      <SettingsContent />
    </AuthGuard>
  );
}
