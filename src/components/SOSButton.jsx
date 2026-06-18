import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { colors } from '../config/colors';

export default function SOSButton({ onLongPress }) {
  return (
    <TouchableOpacity
      testID="sos-button"
      style={styles.button}
      onLongPress={onLongPress}
      delayLongPress={1000}
      activeOpacity={0.8}
    >
      <Text style={styles.icon}>🚨</Text>
      <Text style={styles.label}>SOS</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    backgroundColor: colors.highRisk,
    borderRadius: 999,
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
  },
  icon: { fontSize: 20, lineHeight: 22 },
  label: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
    lineHeight: 18,
  },
});
