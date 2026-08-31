import { Stack } from 'expo-router';
import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useCartStore } from '@/store/cartStore';
import { useProductStore } from '@/store/productStore';
import { useSyncStore } from '@/store/syncStore';
import { useSyncPoller } from '@/hooks/useSyncPoller';
import { useWebSocket } from '@/hooks/useWebSocket';

export default function RootLayout() {
  const initDeviceId = useCartStore((s) => s.initDeviceId);
  const lastSyncVersion = useProductStore((s) => s.lastSyncVersion);
  const applySync = useProductStore((s) => s.applySync);
  const applySyncEvent = useProductStore((s) => s.applySyncEvent);
  const setConnected = useSyncStore((s) => s.setConnected);

  // Live updates from other devices, with a periodic poll as a catch-up.
  useWebSocket(applySyncEvent, setConnected);
  useSyncPoller(lastSyncVersion, applySync);

  useEffect(() => {
    initDeviceId();

    // Show cached data immediately, then refresh the full catalog in the background.
    const store = useProductStore.getState();
    store.hydrateFromCache().then(() => {
      store.loadCategories();
      store.loadTags();
      store.preloadCatalog();
      store.flushBumps(); // replay any bumps queued before a previous kill
    });

    let bootstrapped = false;
    const unsubscribe = NetInfo.addEventListener((state) => {
      // Skip the event that fires on subscribe; startup is handled above.
      if (!bootstrapped) {
        bootstrapped = true;
        return;
      }
      if (state.isConnected) {
        const s = useProductStore.getState();
        s.preloadCatalog(true);
        s.loadCategories();
        s.loadTags();
        s.flushBumps();
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="product/[id]" options={{ title: 'Product Detail' }} />
      <Stack.Screen name="order/[id]" options={{ title: 'Order' }} />
    </Stack>
  );
}
