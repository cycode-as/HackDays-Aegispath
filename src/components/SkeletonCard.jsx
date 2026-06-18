import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export default function SkeletonCard() {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700 }),
        withTiming(0.4, { duration: 700 }),
      ),
      -1,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.card, animStyle]}>
      <View style={styles.topRow}>
        <View style={styles.iconBox} />
        <View style={styles.textBlock}>
          <View style={styles.lineShort} />
          <View style={styles.lineMid} />
        </View>
        <View style={styles.scoreBox} />
      </View>
      <View style={styles.bar} />
      <View style={styles.lineLong} />
      <View style={styles.lineMid2} />
      <View style={styles.pillRow}>
        <View style={styles.pill} />
        <View style={styles.pill} />
        <View style={styles.pill} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#CBD5E1',
  },
  textBlock: { flex: 1, gap: 6 },
  lineShort: { height: 12, width: '50%', backgroundColor: '#CBD5E1', borderRadius: 6 },
  lineMid:   { height: 10, width: '35%', backgroundColor: '#CBD5E1', borderRadius: 6 },
  scoreBox:  { width: 40, height: 36, backgroundColor: '#CBD5E1', borderRadius: 8 },
  bar:       { height: 6, width: '100%', backgroundColor: '#CBD5E1', borderRadius: 6, marginBottom: 12 },
  lineLong:  { height: 10, width: '90%', backgroundColor: '#CBD5E1', borderRadius: 6, marginBottom: 6 },
  lineMid2:  { height: 10, width: '65%', backgroundColor: '#CBD5E1', borderRadius: 6, marginBottom: 12 },
  pillRow:   { flexDirection: 'row', gap: 6 },
  pill:      { height: 22, width: 70, backgroundColor: '#CBD5E1', borderRadius: 999 },
});
