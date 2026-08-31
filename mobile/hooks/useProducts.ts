import { useProductStore } from '@/store/productStore';
import type { Product } from '@/types';

export function useProducts() {
  const products = useProductStore((s) => s.products);
  const isLoading = useProductStore((s) => s.isLoading);
  const nextCursor = useProductStore((s) => s.nextCursor);
  const loadNextPage = useProductStore((s) => s.loadNextPage);

  return { products, isLoading, nextCursor, loadNextPage };
}

export function useProductSearch() {
  // Read products lazily at call time so results reflect whatever the
  // background preload has pulled in so far, without re-rendering on each page.
  const search = (query: string): Product[] => {
    const q = query.trim().toLowerCase();
    const { products } = useProductStore.getState();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  };

  return { search };
}
