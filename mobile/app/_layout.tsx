import { Stack } from 'expo-router';
import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useCartStore } from '@/store/cartStore';
import { useProductStore } from '@/store/productStore';
import { useSyncStore } from '@/store/syncStore';
import { useSyncPoller } from '@/hooks/useSyncPoller';

export default function RootLayout() {
  const initDeviceId = useCartStore((s) => s.initDeviceId);
  const lastSyncVersion = useProductStore((s) => s.lastSyncVersion);
  const applySync = useProductStore((s) => s.applySync);

  // Periodic catch-up in case a WebSocket bump was missed.
  useSyncPoller(lastSyncVersion, applySync);

  useEffect(() => {
    initDeviceId();

    // Show cached data immediately, then refresh the full catalog in the background.
    const store = useProductStore.getState();
    store.hydrateFromCache().then(() => {
      store.loadCategories();
      store.loadTags();
      store.preloadCatalog();
    });

    const setConnected = useSyncStore.getState().setConnected;
    let bootstrapped = false;
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected;
      setConnected(online);
      // Skip the event that fires on subscribe; startup is handled above.
      if (!bootstrapped) {
        bootstrapped = true;
        return;
      }
      if (online) {
        const s = useProductStore.getState();
        s.preloadCatalog(true);
        s.loadCategories();
        s.loadTags();
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
