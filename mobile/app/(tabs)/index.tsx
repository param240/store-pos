import React, { useCallback, useState } from 'react';
import { FlatList, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ProductCard } from '@/components/ProductCard';
import { SearchBar } from '@/components/SearchBar';
import { useProducts } from '@/hooks/useProducts';
import { useAppState } from '@/hooks/useAppState';
import { useCartStore } from '@/store/cartStore';
import type { Product } from '@/types';

export default function ProductsScreen() {
  const router = useRouter();
  const { products, isLoading, nextCursor, loadNextPage } = useProducts();
  const addItem = useCartStore((s) => s.addItem);
  const [searchResults, setSearchResults] = useState<Product[] | null>(null);

  const displayProducts = searchResults ?? products;

  useAppState(() => {
    // foreground resume
  });

  const handleEndReached = useCallback(() => {
    if (!searchResults) loadNextPage();
  }, [searchResults, loadNextPage]);

  const handleAddToCart = useCallback(
    (product: Product) => {
      addItem(product.id, 1);
    },
    [addItem]
  );

  const openProduct = useCallback(
    (product: Product) => router.push(`/product/${product.id}`),
    [router]
  );

  const renderItem = useCallback(({ item }: { item: Product }) => (
    <ProductCard
      product={item}
      onPress={openProduct}
      onAddToCart={handleAddToCart}
    />
  ), [openProduct, handleAddToCart]);

  return (
    <View style={styles.container}>
      <SearchBar onResults={setSearchResults} />
      {isLoading && products.length === 0 ? (
        <ActivityIndicator size="large" color="#1976d2" style={styles.loader} />
      ) : (
        <FlatList
          keyExtractor={(item) => String(item.id)}
          data={displayProducts}
          renderItem={renderItem}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={isLoading ? <ActivityIndicator color="#1976d2" /> : null}
          contentContainerStyle={styles.list}
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={7}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 12 },
  list: { paddingBottom: 20 },
  loader: { flex: 1 },
});
