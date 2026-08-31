import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/services/api';
import {
  CATALOG_CHUNK_SIZE,
  CATALOG_PAGE_SIZE,
  CATEGORIES_KEY,
  PRODUCTS_KEY,
  SYNC_VERSION_KEY,
  TAGS_KEY,
} from '@/constants/config';
import type { Category, Product, SyncEvent, SyncResponse, Tag } from '@/types';

interface ProductState {
  products: Product[];
  categories: Category[];
  tags: Tag[];
  isLoading: boolean;
  isPreloading: boolean;
  catalogLoaded: boolean;
  isOffline: boolean;
  nextCursor: string | null;
  lastSyncVersion: number;
  error: string | null;
  hydrateFromCache: () => Promise<void>;
  preloadCatalog: (force?: boolean) => Promise<void>;
  loadNextPage: () => Promise<void>;
  loadCategories: () => Promise<void>;
  loadTags: () => Promise<void>;
  bumpProduct: (id: number, expectedVersion: number) => Promise<void>;
  applySyncEvent: (event: SyncEvent) => void;
  applySync: (response: SyncResponse) => void;
}

async function persistProducts(products: Product[]) {
  const chunks: [string, string][] = [];
  for (let i = 0; i < products.length; i += CATALOG_CHUNK_SIZE) {
    const chunk = products.slice(i, i + CATALOG_CHUNK_SIZE);
    chunks.push([`${PRODUCTS_KEY}:${i / CATALOG_CHUNK_SIZE}`, JSON.stringify(chunk)]);
  }
  await AsyncStorage.setItem(`${PRODUCTS_KEY}:count`, String(chunks.length));
  if (chunks.length) await AsyncStorage.multiSet(chunks);
}

async function readProducts(): Promise<Product[]> {
  const countRaw = await AsyncStorage.getItem(`${PRODUCTS_KEY}:count`);
  const count = countRaw ? Number(countRaw) : 0;
  if (!count) return [];
  const keys = Array.from({ length: count }, (_, i) => `${PRODUCTS_KEY}:${i}`);
  const pairs = await AsyncStorage.multiGet(keys);
  const products: Product[] = [];
  for (const [, value] of pairs) {
    if (value) products.push(...(JSON.parse(value) as Product[]));
  }
  return products;
}

function mergeById(existing: Product[], incoming: Product[]): Product[] {
  const byId = new Map(existing.map((p) => [p.id, p]));
  for (const p of incoming) byId.set(p.id, p);
  return Array.from(byId.values());
}

// Categories are a nested tree, so walk children to find the bumped one.
function bumpCategoryVersion(categories: Category[], event: SyncEvent): Category[] {
  return categories.map((c) => {
    if (c.id === event.entity_id) {
      return event.version > c.version
        ? { ...c, version: event.version, updated_at: event.updated_at }
        : c;
    }
    if (c.children && c.children.length) {
      return { ...c, children: bumpCategoryVersion(c.children, event) };
    }
    return c;
  });
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  categories: [],
  tags: [],
  isLoading: false,
  isPreloading: false,
  catalogLoaded: false,
  isOffline: false,
  nextCursor: null,
  // Seed baseline is version 1, so /sync?since=1 returns only entities bumped
  // since seed - starting at 0 would pull the whole catalog every poll.
  lastSyncVersion: 1,
  error: null,

  hydrateFromCache: async () => {
    try {
      const [products, categoriesRaw, tagsRaw, versionRaw] = await Promise.all([
        readProducts(),
        AsyncStorage.getItem(CATEGORIES_KEY),
        AsyncStorage.getItem(TAGS_KEY),
        AsyncStorage.getItem(SYNC_VERSION_KEY),
      ]);
      const patch: Partial<ProductState> = {};
      if (products.length) patch.products = products;
      if (categoriesRaw) patch.categories = JSON.parse(categoriesRaw);
      if (tagsRaw) patch.tags = JSON.parse(tagsRaw);
      if (versionRaw) patch.lastSyncVersion = Math.max(1, Number(versionRaw));
      if (Object.keys(patch).length) set(patch);
    } catch {
      // A corrupt/unreadable cache shouldn't block startup.
    }
  },

  // Walk the whole catalog in the background so search and offline browsing
  // have the full product set, not just the pages the user scrolled to.
  preloadCatalog: async (force = false) => {
    const { isPreloading, catalogLoaded } = get();
    if (isPreloading || (catalogLoaded && !force)) return;

    set({ isPreloading: true, isLoading: get().products.length === 0 });
    try {
      let cursor: string | undefined;
      let merged = get().products;
      let hasMore = true;
      while (hasMore) {
        const res = await api.getProducts(cursor, CATALOG_PAGE_SIZE);
        if (res.data.length === 0) break;
        merged = mergeById(merged, res.data);
        // Advance from the last returned item's own cursor. The server's
        // next_cursor points at the following row, which its id filter then
        // skips - so trusting it drops one product per page.
        cursor = res.data[res.data.length - 1].cursor;
        hasMore = res.next_cursor !== null;
        set({ products: merged, nextCursor: res.next_cursor, isOffline: false });
      }

      set({ catalogLoaded: true, isPreloading: false, isLoading: false, error: null });
      persistProducts(merged);
      AsyncStorage.setItem(SYNC_VERSION_KEY, String(get().lastSyncVersion));
    } catch {
      set({
        isPreloading: false,
        isLoading: false,
        isOffline: true,
        error: get().products.length ? null : 'Failed to load products',
      });
    }
  },

  // Fallback for fast scrolling before the preload has caught up.
  loadNextPage: async () => {
    const { nextCursor, products, isLoading, isPreloading, catalogLoaded } = get();
    if (!nextCursor || isLoading || isPreloading || catalogLoaded) return;
    set({ isLoading: true });
    try {
      const last = products[products.length - 1];
      const res = await api.getProducts(last?.cursor);
      set({
        products: mergeById(products, res.data),
        nextCursor: res.next_cursor,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  loadCategories: async () => {
    try {
      const categories = await api.getCategories();
      set({ categories, isOffline: false });
      AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
    } catch {
      if (get().categories.length === 0) set({ error: 'Failed to load categories' });
      set({ isOffline: true });
    }
  },

  loadTags: async () => {
    try {
      const tags = await api.getTags();
      set({ tags, isOffline: false });
      AsyncStorage.setItem(TAGS_KEY, JSON.stringify(tags));
    } catch {
      set({ isOffline: true });
    }
  },

  bumpProduct: async (id: number, expectedVersion: number) => {
    try {
      const result = await api.bumpProduct(id, expectedVersion);
      set((state) => ({
        products: state.products.map((p) =>
          p.id === id ? { ...p, version: result.version } : p
        ),
      }));
    } catch (e) {
      console.error('Bump failed', e);
    }
  },

  // Apply a single bump (from the WebSocket) to whichever entity it targets,
  // ignoring anything not newer than what we already hold.
  applySyncEvent: (event: SyncEvent) => {
    set((state) => {
      const patch: Partial<ProductState> = {
        lastSyncVersion: Math.max(state.lastSyncVersion, event.version),
      };
      switch (event.type) {
        case 'product_bump':
          patch.products = state.products.map((p) =>
            p.id === event.entity_id && event.version > p.version
              ? { ...p, version: event.version, updated_at: event.updated_at }
              : p
          );
          break;
        case 'category_bump':
          patch.categories = bumpCategoryVersion(state.categories, event);
          break;
        case 'tag_bump':
          patch.tags = state.tags.map((t) =>
            t.id === event.entity_id && event.version > t.version
              ? { ...t, version: event.version, updated_at: event.updated_at }
              : t
          );
          break;
      }
      return patch;
    });
  },

  applySync: (response: SyncResponse) => {
    const { applySyncEvent } = get();
    [...response.products, ...response.categories, ...response.tags].forEach(applySyncEvent);
  },
}));
