import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { colors } from '../config/colors';

export default function DayNightToggle({ timeMode, onToggle }) {
  const [pillWidth, setPillWidth] = useState(0);
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (pillWidth === 0) return;
    const target = timeMode === 'night' ? pillWidth : 0;
    translateX.value = withSpring(target, { stiffness: 200, damping: 20 });
  }, [timeMode, pillWidth]);

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const handleContainerLayout = (e) => {
    const containerWidth = e.nativeEvent.layout.width;
    const computed = containerWidth / 2;
    if (computed !== pillWidth) setPillWidth(computed);
  };

  return (
    <View style={styles.container} onLayout={handleContainerLayout}>
      {pillWidth > 0 && (
        <Animated.View
          style={[
            styles.indicator,
            { width: pillWidth },
            animatedIndicatorStyle,
          ]}
        />
      )}
      <TouchableOpacity style={styles.pill} onPress={() => onToggle('day')}>
        <Text style={[styles.text, timeMode === 'day' && styles.activeText]}>
          🌤 Day
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.pill} onPress={() => onToggle('night')}>
        <Text style={[styles.text, timeMode === 'night' && styles.activeText]}>
          🌙 Night
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#E8EDFF',
    borderRadius: 999,
    padding: 3,
    width: 140, // fixed so it never overflows the header
  },
  pill: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    position: 'absolute',
    top: 3,
    left: 3,
    bottom: 3,
    borderRadius: 999,
    backgroundColor: colors.brand,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.brand,
  },
  activeText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
