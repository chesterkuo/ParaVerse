import { useEffect, useRef, useState, useCallback } from "react";

interface SimEvent {
  type: string;
  [key: string]: unknown;
}

const WS_BASE = import.meta.env.VITE_WS_BASE_URL || `ws://${window.location.host}`;

export function useWebSocket(path: string) {
  const [events, setEvents] = useState<SimEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const retriesRef = useRef(0);

  const connect = useCallback(() => {
    const token = localStorage.getItem("access_token");
    const url = token
      ? `${WS_BASE}${path}?token=${encodeURIComponent(token)}`
      : `${WS_BASE}${path}`;

    const ws = new WebSocket(url);

    ws.onopen = () => {
      setConnected(true);
      retriesRef.current = 0;
    };

    ws.onmessage = (msg) => {
      try {
        const event: SimEvent = JSON.parse(msg.data);
        setEvents((prev) => [...prev.slice(-200), event]);
      } catch { /* ignore invalid */ }
    };

    ws.onclose = () => {
      setConnected(false);
      // Exponential backoff: 1s, 2s, 4s, 8s... capped at 30s
      const delay = Math.min(1000 * Math.pow(2, retriesRef.current), 30000);
      retriesRef.current++;
      reconnectTimeout.current = setTimeout(connect, delay);
    };

    ws.onerror = () => ws.close();

    wsRef.current = ws;
  }, [path]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data: unknown) => {
    wsRef.current?.send(JSON.stringify(data));
  }, []);

  return { events, connected, send };
}
