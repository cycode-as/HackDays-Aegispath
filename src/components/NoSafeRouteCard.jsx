/**
 * NoSafeRouteCard — shown when all available routes are HIGH risk.
 * The app never lies by calling something "safe" if it isn't.
 * Instead it gives honest alternatives.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../config/colors';

const ALTERNATIVES = [
  { icon: '🕐', text: 'Wait for safer hours (after 8 AM)' },
  { icon: '🚕', text: 'Take a cab instead of walking' },
  { icon: '👥', text: 'Travel with someone you trust' },
  { icon: '📍', text: 'Share live location with a contact' },
  { icon: '🏪', text: 'Move toward a nearby open business' },
];

export default function NoSafeRouteCard({ onDismiss, navigation }) {
  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>⚠️</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>No low-risk route available</Text>
          <Text style={styles.sub}>All routes carry elevated risk right now</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Alternatives */}
      <Text style={styles.altTitle}>Safer alternatives</Text>
      {ALTERNATIVES.map((a, i) => (
        <View key={i} style={styles.altRow}>
          <Text style={styles.altIcon}>{a.icon}</Text>
          <Text style={styles.altText}>{a.text}</Text>
        </View>
      ))}

      {/* Dismiss */}
      {onDismiss && (
        <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss} activeOpacity={0.75}>
          <Text style={styles.dismissText}>I understand, show routes anyway</Text>
        </TouchableOpacity>
      )}

      {/* Risk Mitigation guidance */}
      {navigation && (
        <TouchableOpacity
          style={styles.mitigateBtn}
          onPress={() => navigation.navigate('RiskMitigation')}
          activeOpacity={0.85}
        >
          <Text style={styles.mitigateBtnText}>Get safety guidance →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.highRisk,
    padding: 18,
    marginHorizontal: 16,
    marginTop: 8,
    shadowColor: colors.highRisk,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.riskLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  icon: { fontSize: 22 },
  headerText: { flex: 1 },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.highRisk,
    marginBottom: 3,
  },
  sub: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: colors.cardBorder,
    marginBottom: 14,
  },
  altTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  altRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  altIcon: { fontSize: 18, width: 26, textAlign: 'center' },
  altText: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
    lineHeight: 19,
  },
  dismissBtn: {
    marginTop: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    marginBottom: 8,
  },
  dismissText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  mitigateBtn: {
    backgroundColor: colors.brand,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  mitigateBtnText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
