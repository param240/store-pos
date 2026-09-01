import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useToastStore } from '@/store/toastStore';

export function Toast() {
  const message = useToastStore((s) => s.message);
  const [shown, setShown] = useState('');
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (message) setShown(message);
    Animated.timing(anim, {
      toValue: message ? 1 : 0,
      duration: message ? 160 : 220,
      useNativeDriver: true,
    }).start();
  }, [message, anim]);

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Animated.View
        style={[
          styles.toast,
          {
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          },
        ]}
      >
        <Text style={styles.text}>{shown}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 36, alignItems: 'center' },
  toast: { backgroundColor: '#2f3438', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 22 },
  text: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
