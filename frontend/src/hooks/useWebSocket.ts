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

  const connect = useCallback(() => {
    const ws = new WebSocket(`${WS_BASE}${path}`);

    ws.onopen = () => setConnected(true);

    ws.onmessage = (msg) => {
      try {
        const event: SimEvent = JSON.parse(msg.data);
        setEvents((prev) => [...prev.slice(-200), event]);
      } catch { /* ignore invalid */ }
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectTimeout.current = setTimeout(connect, 3000);
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
