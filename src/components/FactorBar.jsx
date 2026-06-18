import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../config/colors';

// Factor icon map — matches the Risk Analysis screen in the design
const FACTOR_META = {
  Crime: { icon: '⚠️', displayLabel: 'High Crime Zone',     subtitle: 'Reported incidents in last 30 days' },
  Time:  { icon: '🌙', displayLabel: 'Night-time Risk',     subtitle: 'Higher risk after sunset' },
  Crowd: { icon: '👥', displayLabel: 'Low Crowd Density',   subtitle: 'Few pedestrians at this hour' },
  Infra: { icon: '💡', displayLabel: 'Poor Lighting',       subtitle: 'Streetlight coverage below average' },
};

export function getFactorBarColor(value) {
  if (value < 35) return colors.safe;
  if (value < 60) return colors.moderate;
  return colors.highRisk;
}

export default function FactorBar({ label, value }) {
  const fillWidth = useSharedValue(0);
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    if (trackWidth > 0) {
      fillWidth.value = withTiming((value / 100) * trackWidth, { duration: 600 });
    }
  }, [trackWidth, value]);

  const animatedFillStyle = useAnimatedStyle(() => ({ width: fillWidth.value }));
  const fillColor = getFactorBarColor(value);
  const meta = FACTOR_META[label] || { icon: '📊', displayLabel: label, subtitle: '' };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, { backgroundColor: fillColor + '22' }]}>
          <Text style={styles.icon}>{meta.icon}</Text>
        </View>
        <View style={styles.textBlock}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{meta.displayLabel}</Text>
            <Text style={[styles.percentage, { color: fillColor }]}>{value}%</Text>
          </View>
          <Text style={styles.subtitle}>{meta.subtitle}</Text>
          <View
            testID="factor-bar-track"
            style={styles.track}
            onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
          >
            <Animated.View
              testID="factor-bar-fill"
              style={[styles.fill, animatedFillStyle, { backgroundColor: fillColor }]}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  icon: { fontSize: 18 },
  textBlock: { flex: 1 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  percentage: {
    fontSize: 14,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 6,
  },
  track: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});
