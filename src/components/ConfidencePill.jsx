import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ConfidencePill({ icon, label, type, testID }) {
  const bg   = type === 'safe' ? '#DCFCE7' : '#FEE2E2';
  const text = type === 'safe' ? '#15803D' : '#B91C1C';

  return (
    <View testID={testID || 'confidence-pill'} style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: text }]}>
        {icon} {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginRight: 6,
    marginBottom: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
});
