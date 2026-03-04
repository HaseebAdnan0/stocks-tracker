'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import LoadingSpinner from './LoadingSpinner';
import { formatPKR } from '@/utils/formatters';

const PERIODS = [
  { label: '1M', value: '1M' },
  { label: '3M', value: '3M' },
  { label: '6M', value: '6M' },
  { label: '1Y', value: '1Y' },
  { label: '3Y', value: '3Y' },
  { label: '5Y', value: '5Y' },
];

interface ChartData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface PriceChartProps {
  symbol: string;
  buyPrice?: number | null;
}

export default function PriceChart({ symbol, buyPrice }: PriceChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('6M');
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChartData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/stock/${symbol}/history?period=${selectedPeriod}`);
      if (!response.ok) {
        throw new Error('Failed to fetch chart data');
      }

      const data = await response.json();
      setChartData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching chart data:', err);
    } finally {
      setLoading(false);
    }
  }, [symbol, selectedPeriod]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
  };

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: { payload: ChartData; value: number }[];
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 shadow-lg">
          <p className="text-white text-sm font-semibold">{payload[0].payload.date}</p>
          <p className="text-green-400 text-sm">{formatPKR(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">Price Chart</h2>
        <LoadingSpinner message="Loading chart data..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">Price Chart</h2>
        <p className="text-red-500">Error: {error}</p>
        <button
          onClick={fetchChartData}
          className="mt-4 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">Price Chart</h2>
        <p className="text-gray-400">No chart data available for {symbol}</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold text-white">Price Chart</h2>

        <div className="flex gap-2 flex-wrap">
          {PERIODS.map((period) => (
            <button
              key={period.value}
              onClick={() => handlePeriodChange(period.value)}
              className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                selectedPeriod === period.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="date"
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            tickFormatter={(value: string) => {
              const date = new Date(value);
              if (selectedPeriod === '3Y' || selectedPeriod === '5Y') {
                return `${date.getMonth() + 1}/${date.getFullYear().toString().slice(-2)}`;
              }
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }}
          />
          <YAxis
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            tickFormatter={(value: number) => `₨${value.toFixed(0)}`}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="close"
            stroke="#10B981"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: '#10B981' }}
          />
          {buyPrice && (
            <ReferenceLine
              y={buyPrice}
              stroke="#FBBF24"
              strokeDasharray="5 5"
              strokeWidth={2}
              label={{
                value: `Buy: ${formatPKR(buyPrice)}`,
                position: 'right',
                fill: '#FBBF24',
                fontSize: 12,
                fontWeight: 'bold',
              }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 pt-4 border-t border-gray-700 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-gray-400 mb-1">Period High</div>
          <div className="text-white font-semibold">
            {formatPKR(Math.max(...chartData.map((d) => d.high || d.close)))}
          </div>
        </div>
        <div>
          <div className="text-gray-400 mb-1">Period Low</div>
          <div className="text-white font-semibold">
            {formatPKR(Math.min(...chartData.map((d) => d.low || d.close)))}
          </div>
        </div>
        <div>
          <div className="text-gray-400 mb-1">Start Price</div>
          <div className="text-white font-semibold">{formatPKR(chartData[0]?.close)}</div>
        </div>
        <div>
          <div className="text-gray-400 mb-1">End Price</div>
          <div className="text-white font-semibold">
            {formatPKR(chartData[chartData.length - 1]?.close)}
          </div>
        </div>
      </div>
    </div>
  );
}
