'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface TickData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  ldcp: number;
  open: number;
  timestamp: number;
}

interface WebSocketMessage {
  type: string;
  data?: TickData;
  market?: string;
  symbols?: string[];
}

interface UsePSXWebSocketOptions {
  symbols: string[];
  enabled?: boolean;
  onTick?: (tick: TickData) => void;
}

interface UsePSXWebSocketReturn {
  ticks: Map<string, TickData>;
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
}

const WS_URL = 'wss://psxterminal.com';
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

export function usePSXWebSocket({
  symbols,
  enabled = true,
  onTick,
}: UsePSXWebSocketOptions): UsePSXWebSocketReturn {
  const [ticks, setTicks] = useState<Map<string, TickData>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const symbolsRef = useRef<string[]>(symbols);

  // Update symbols ref when symbols change
  useEffect(() => {
    symbolsRef.current = symbols;
  }, [symbols]);

  const connect = useCallback(() => {
    if (!enabled || symbols.length === 0) return;

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('PSX WebSocket connected');
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;

        // Subscribe to market data
        const subscribeMessage = {
          type: 'subscribe',
          market: 'REG',
          symbols: symbolsRef.current,
        };
        ws.send(JSON.stringify(subscribeMessage));
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          if (message.type === 'tick' && message.data) {
            const tick = message.data;

            // Calculate ldcp from price and change if not provided
            const ldcp = tick.ldcp ?? (tick.price - tick.change);
            const tickWithLdcp = { ...tick, ldcp, open: tick.open ?? ldcp };

            setTicks((prev) => {
              const next = new Map(prev);
              next.set(tick.symbol, tickWithLdcp);
              return next;
            });

            if (onTick) {
              onTick(tickWithLdcp);
            }
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onerror = (event) => {
        console.error('PSX WebSocket error:', event);
        setError('WebSocket connection error');
      };

      ws.onclose = (event) => {
        console.log('PSX WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;

        // Attempt to reconnect
        if (enabled && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          console.log(`Reconnecting... attempt ${reconnectAttemptsRef.current}`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_DELAY);
        } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setError('Failed to connect after multiple attempts');
        }
      };
    } catch (e) {
      console.error('Failed to create WebSocket:', e);
      setError('Failed to create WebSocket connection');
    }
  }, [enabled, symbols.length, onTick]);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    setError(null);
    connect();
  }, [connect]);

  // Connect on mount and when symbols change
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Resubscribe when symbols change
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && symbols.length > 0) {
      const subscribeMessage = {
        type: 'subscribe',
        market: 'REG',
        symbols: symbols,
      };
      wsRef.current.send(JSON.stringify(subscribeMessage));
    }
  }, [symbols]);

  return { ticks, isConnected, error, reconnect };
}
