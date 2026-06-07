import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '@/theme';

export function SpinnerRing() {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 900, useNativeDriver: true })
    ).start();
  }, [rotateAnim]);
  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return <Animated.View style={[styles.ring, { transform: [{ rotate }] }]} />;
}

const styles = StyleSheet.create({
  ring: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: Colors.bg.surfaceStrong,
    borderTopColor: Colors.moss,
  } as ViewStyle,
});
