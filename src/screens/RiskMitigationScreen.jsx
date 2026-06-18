/**
 * RiskMitigationScreen — §13 Risk Mitigation Mode
 *
 * Shown when no safe route exists and user wants guidance.
 * Transitions from "route optimization" to "safety preparation."
 * Tone: calm, professional, informative. Never panic-inducing.
 */

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, StatusBar, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../config/colors';

const MITIGATION_STEPS = [
  {
    icon: '🕐',
    title: 'Wait for safer hours',
    body: 'Safety scores improve significantly after 8 AM. Consider delaying your trip by 1–2 hours.',
    tag: 'Recommended',
    tagColor: colors.safe,
  },
  {
    icon: '🚕',
    title: 'Switch to cab mode',
    body: 'Cab travel reduces exposure to isolated stretches. Route deviation monitoring will be active.',
    tag: 'Lower risk',
    tagColor: colors.brand,
  },
  {
    icon: '👥',
    title: 'Travel with someone',
    body: 'Crowd presence significantly reduces personal risk. Coordinate with a trusted contact.',
    tag: 'Effective',
    tagColor: colors.safe,
  },
  {
    icon: '📍',
    title: 'Enable live location sharing',
    body: 'Share your real-time location with emergency contacts before you leave.',
    tag: 'Always on',
    tagColor: colors.brand,
  },
  {
    icon: '🏪',
    title: 'Move toward active areas',
    body: 'Stay near open businesses, markets, or metro stations. Avoid isolated lanes.',
    tag: 'Situational',
    tagColor: colors.moderate,
  },
];

const RISK_INDICATORS = [
  { label: 'Crime level',     value: 'Elevated',  color: colors.highRisk  },
  { label: 'Crowd density',   value: 'Very low',  color: colors.highRisk  },
  { label: 'Lighting',        value: 'Poor',      color: colors.moderate  },
  { label: 'Time of day',     value: 'Late night', color: colors.moderate },
  { label: 'Emergency access', value: 'Limited',  color: colors.moderate  },
];

export default function RiskMitigationScreen({ navigation }) {
  const [expanded, setExpanded] = useState(null);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={s.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={s.headerText}>
            <Text style={s.title}>Risk Mitigation Mode</Text>
            <Text style={s.subtitle}>Guidance for elevated-risk conditions</Text>
          </View>
        </View>

        {/* Status banner */}
        <View style={s.statusBanner}>
          <View style={s.statusDot} />
          <View style={s.statusTextBlock}>
            <Text style={s.statusTitle}>No low-risk route available</Text>
            <Text style={s.statusSub}>
              All routes currently exceed safe thresholds. Here's how to reduce your risk.
            </Text>
          </View>
        </View>

        {/* Current risk indicators */}
        <View style={s.sectionCard}>
          <Text style={s.sectionLabel}>Current conditions</Text>
          {RISK_INDICATORS.map((item, i) => (
            <View
              key={i}
              style={[s.indicatorRow, i < RISK_INDICATORS.length - 1 && s.indicatorBorder]}
            >
              <Text style={s.indicatorLabel}>{item.label}</Text>
              <View style={[s.indicatorBadge, { backgroundColor: item.color + '18' }]}>
                <Text style={[s.indicatorValue, { color: item.color }]}>{item.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Mitigation steps */}
        <Text style={s.mitigationHeading}>Recommended actions</Text>
        {MITIGATION_STEPS.map((step, i) => {
          const isOpen = expanded === i;
          return (
            <TouchableOpacity
              key={i}
              style={[s.stepCard, isOpen && s.stepCardOpen]}
              onPress={() => setExpanded(isOpen ? null : i)}
              activeOpacity={0.85}
            >
              <View style={s.stepTop}>
                <View style={s.stepIconWrap}>
                  <Text style={s.stepIcon}>{step.icon}</Text>
                </View>
                <View style={s.stepTextBlock}>
                  <Text style={s.stepTitle}>{step.title}</Text>
                  <View style={[s.stepTag, { backgroundColor: step.tagColor + '18' }]}>
                    <Text style={[s.stepTagText, { color: step.tagColor }]}>{step.tag}</Text>
                  </View>
                </View>
                <Text style={s.stepChevron}>{isOpen ? '▲' : '▼'}</Text>
              </View>
              {isOpen && (
                <Text style={s.stepBody}>{step.body}</Text>
              )}
            </TouchableOpacity>
          );
        })}

        {/* CTA */}
        <TouchableOpacity
          style={s.ctaBtn}
          onPress={() => navigation.navigate('RouteComparison')}
          activeOpacity={0.85}
        >
          <Text style={s.ctaBtnText}>View Routes Anyway →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.sosBtn}
          onPress={() => navigation.navigate('SOS')}
          activeOpacity={0.85}
        >
          <Text style={s.sosBtnText}>🚨 Activate Emergency SOS</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.background },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8 },

  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 12, paddingTop: 8, marginBottom: 20,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
    flexShrink: 0, marginTop: 2,
  },
  backIcon: { fontSize: 18, color: colors.textPrimary },
  headerText: { flex: 1 },
  title:    { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  /* Status banner */
  statusBanner: {
    flexDirection: 'row',
    backgroundColor: colors.moderateLight,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.moderate + '40',
    alignItems: 'flex-start',
  },
  statusDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.moderate,
    marginTop: 4, flexShrink: 0,
  },
  statusTextBlock: { flex: 1 },
  statusTitle: {
    fontSize: 14, fontWeight: '800',
    color: '#92400E', marginBottom: 4,
  },
  statusSub: {
    fontSize: 13, color: '#78350F', lineHeight: 18,
  },

  /* Risk indicators */
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 16, padding: 16,
    marginBottom: 20,
    borderWidth: 1, borderColor: colors.cardBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  sectionLabel: {
    fontSize: 12, fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5, textTransform: 'uppercase',
    marginBottom: 12,
  },
  indicatorRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  indicatorBorder: {
    borderBottomWidth: 1, borderBottomColor: colors.cardBorder,
  },
  indicatorLabel: {
    fontSize: 14, fontWeight: '500', color: colors.textPrimary,
  },
  indicatorBadge: {
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  indicatorValue: {
    fontSize: 12, fontWeight: '700',
  },

  /* Mitigation steps */
  mitigationHeading: {
    fontSize: 15, fontWeight: '800',
    color: colors.textPrimary, marginBottom: 12,
  },
  stepCard: {
    backgroundColor: colors.surface,
    borderRadius: 14, padding: 14,
    marginBottom: 10,
    borderWidth: 1, borderColor: colors.cardBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  stepCardOpen: {
    borderColor: colors.brand,
    backgroundColor: '#FAFBFF',
  },
  stepTop: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  stepIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  stepIcon: { fontSize: 20 },
  stepTextBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  stepTitle: {
    fontSize: 14, fontWeight: '700', color: colors.textPrimary,
  },
  stepTag: {
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3,
  },
  stepTagText: { fontSize: 11, fontWeight: '700' },
  stepChevron: {
    fontSize: 11, color: colors.textSecondary, flexShrink: 0,
  },
  stepBody: {
    fontSize: 13, color: colors.textSecondary,
    lineHeight: 19, marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1, borderTopColor: colors.cardBorder,
  },

  /* CTAs */
  ctaBtn: {
    backgroundColor: colors.brand,
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 8, marginBottom: 10,
    shadowColor: colors.brand, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  ctaBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  sosBtn: {
    backgroundColor: colors.riskLight,
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.highRisk + '40',
  },
  sosBtnText: { color: colors.highRisk, fontSize: 15, fontWeight: '700' },
});
