import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { getRiskColor } from '../config/colors';

export default function ScoreBar({ safetyScore, riskLevel }) {
  const barColor = getRiskColor(riskLevel);
  const fillWidth = useSharedValue(0);
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    if (trackWidth > 0) {
      fillWidth.value = withTiming((safetyScore / 100) * trackWidth, {
        duration: 600,
      });
    }
  }, [trackWidth, safetyScore]);

  const animStyle = useAnimatedStyle(() => ({ width: fillWidth.value }));

  return (
    <View
      style={styles.track}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View style={[styles.fill, animStyle, { backgroundColor: barColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    overflow: 'hidden',
    marginVertical: 8,
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});
