import { useEffect, useRef } from 'react';
import { WS_URL } from '@/constants/config';
import type { SyncEvent } from '@/types';

export function useWebSocket(
  onMessage: (event: SyncEvent) => void,
  onStatus?: (connected: boolean) => void
) {
  const onMessageRef = useRef(onMessage);
  const onStatusRef = useRef(onStatus);
  onMessageRef.current = onMessage;
  onStatusRef.current = onStatus;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let closed = false;

    const connect = () => {
      ws = new WebSocket(`${WS_URL}/ws`);

      ws.onopen = () => {
        attempts = 0;
        onStatusRef.current?.(true);
      };

      ws.onmessage = (e) => {
        try {
          onMessageRef.current(JSON.parse(e.data) as SyncEvent);
        } catch {
          // Ignore malformed frames rather than crashing the app.
        }
      };

      ws.onerror = () => {
        ws?.close();
      };

      ws.onclose = () => {
        onStatusRef.current?.(false);
        if (closed) return;
        const delay = Math.min(30000, 1000 * 2 ** attempts);
        attempts += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);
}
