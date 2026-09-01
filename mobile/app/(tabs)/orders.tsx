import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api, ApiError } from '@/services/api';
import { useCartStore } from '@/store/cartStore';
import type { Order } from '@/types';

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [payingId, setPayingId] = useState<number | null>(null);
  const deviceId = useCartStore((s) => s.deviceId);

  const loadOrders = async () => {
    try {
      const data = await api.getOrders(deviceId);
      setOrders(data);
    } catch {
      Alert.alert('Error', 'Failed to load orders');
    }
  };

  // Tab screens stay mounted, so refetch every time this tab regains focus.
  useFocusEffect(
    useCallback(() => {
      if (deviceId) loadOrders();
    }, [deviceId])
  );

  const handlePay = async (orderId: number) => {
    if (payingId !== null) return;
    setPayingId(orderId);
    try {
      const result = await api.payOrder(orderId);
      Alert.alert(
        result.payment_status === 'success' ? 'Payment successful' : 'Payment failed',
        result.payment_status === 'success'
          ? `Order status: ${result.order_status}`
          : 'The payment did not go through. This order is now marked failed - place a new order to try again.'
      );
    } catch (err) {
      if (err instanceof ApiError && err.code === 'order_not_in_draft') {
        Alert.alert('Cannot pay', 'This order can no longer be paid - it may already be paid or failed.');
      } else {
        Alert.alert('Error', 'Payment request failed. Check your connection and try again.');
      }
    } finally {
      setPayingId(null);
      loadOrders();
    }
  };

  const statusColor = (status: Order['status']) =>
    ({ draft: '#ff9800', paid: '#4caf50', failed: '#f44336' }[status]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Orders</Text>
      <FlatList
        data={orders}
        keyExtractor={(o) => String(o.id)}
        renderItem={({ item }) => (
          <View style={styles.order}>
            <View>
              <Text style={styles.orderId}>Order #{item.id}</Text>
              <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>
            </View>
            <View style={styles.right}>
              <Text style={[styles.status, { color: statusColor(item.status) }]}>
                {item.status.toUpperCase()}
              </Text>
              {item.status === 'draft' && (
                <TouchableOpacity
                  style={[styles.payBtn, payingId === item.id && styles.payBtnDisabled]}
                  onPress={() => handlePay(item.id)}
                  disabled={payingId === item.id}
                >
                  <Text style={styles.payBtnText}>{payingId === item.id ? 'Processing…' : 'Pay'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No orders yet</Text>}
        onRefresh={loadOrders}
        refreshing={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 12 },
  heading: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  order: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8 },
  orderId: { fontSize: 16, fontWeight: '600' },
  date: { fontSize: 12, color: '#9e9e9e', marginTop: 2 },
  right: { alignItems: 'flex-end' },
  status: { fontWeight: '700', fontSize: 14 },
  payBtn: { backgroundColor: '#1976d2', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, marginTop: 4 },
  payBtnDisabled: { backgroundColor: '#90caf9' },
  payBtnText: { color: '#fff', fontWeight: '600' },
  empty: { textAlign: 'center', color: '#9e9e9e', marginTop: 40, fontSize: 16 },
});
