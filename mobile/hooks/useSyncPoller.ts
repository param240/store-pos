import { useEffect, useRef } from 'react';
import { POLL_INTERVAL_MS } from '@/constants/config';
import { api } from '@/services/api';
import type { SyncResponse } from '@/types';

export function useSyncPoller(
  sinceVersion: number,
  onSync: (response: SyncResponse) => void
) {
  // Keep the latest values in refs so a changing sinceVersion doesn't tear down
  // and recreate the interval (which is how the old version stacked timers).
  const sinceRef = useRef(sinceVersion);
  const onSyncRef = useRef(onSync);
  sinceRef.current = sinceVersion;
  onSyncRef.current = onSync;

  useEffect(() => {
    let active = true;
    let polling = false;

    const poll = async () => {
      if (polling) return; // don't stack a request on top of a slow one
      polling = true;
      try {
        const response = await api.getSync(sinceRef.current);
        if (!active) return;
        const hasEvents =
          response.products.length > 0 ||
          response.categories.length > 0 ||
          response.tags.length > 0;
        if (hasEvents) onSyncRef.current(response);
      } catch {
        // Offline or a transient failure - just wait for the next tick.
      } finally {
        polling = false;
      }
    };

    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);
}
