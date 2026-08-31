import React, { useEffect, useRef, useState } from 'react';
import { TextInput, View, StyleSheet } from 'react-native';
import { useProductSearch } from '@/hooks/useProducts';
import type { Product } from '@/types';

interface Props {
  onResults: (products: Product[] | null) => void;
}

export function SearchBar({ onResults }: Props) {
  const [query, setQuery] = useState('');
  const { search } = useProductSearch();
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const handleChange = (text: string) => {
    setQuery(text);
    if (timer.current) clearTimeout(timer.current);

    if (!text.trim()) {
      onResults(null);
      return;
    }

    timer.current = setTimeout(() => onResults(search(text)), 250);
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={handleChange}
        placeholder="Search products..."
        placeholderTextColor="#9e9e9e"
        returnKeyType="search"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 8, paddingHorizontal: 12, marginBottom: 12 },
  input: { flex: 1, height: 44, fontSize: 14, color: '#333' },
});
