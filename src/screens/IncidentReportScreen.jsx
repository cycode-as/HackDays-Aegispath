import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../config/colors';

const INCIDENT_TYPES = [
  { id: 'harassment',  icon: '⚠️', label: 'Harassment',          color: '#EF4444' },
  { id: 'suspicious',  icon: '👁',  label: 'Suspicious Activity', color: '#F59E0B' },
  { id: 'lighting',    icon: '🌑', label: 'Poor Lighting',        color: '#6366F1' },
  { id: 'unsafe',      icon: '🚧', label: 'Unsafe Area',          color: '#EF4444' },
  { id: 'accident',    icon: '🚨', label: 'Accident',             color: '#EF4444' },
  { id: 'isolation',   icon: '🛤️', label: 'Road Isolation',       color: '#F59E0B' },
];

const SEVERITIES = [
  { id: 'low',    label: 'Low',    color: colors.safe     },
  { id: 'medium', label: 'Medium', color: colors.moderate },
  { id: 'high',   label: 'High',   color: colors.highRisk },
];

export default function IncidentReportScreen({ navigation }) {
  const [selectedType,     setSelectedType]     = useState(null);
  const [selectedSeverity, setSelectedSeverity] = useState('medium');
  const [phase,            setPhase]            = useState('form');

  const handleSubmit = () => {
    if (!selectedType) return;
    setPhase('loading');
    setTimeout(() => setPhase('success'), 800);
  };

  if (phase === 'success') {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={s.centeredWrap}>
          <View style={s.successCircle}>
            <Text style={s.successCheck}>✓</Text>
          </View>
          <Text style={s.successTitle}>Report submitted.</Text>
          <Text style={s.successSub}>
            Thank you. This helps keep others safe on this route.
          </Text>
          <TouchableOpacity style={s.doneBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Text style={s.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'loading') {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={s.centeredWrap}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={s.loadingText}>Submitting report…</Text>
        </View>
      </SafeAreaView>
    );
  }

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
            <Text style={s.title}>Report an Incident</Text>
            <Text style={s.subtitle}>Help keep this route safer for everyone</Text>
          </View>
        </View>

        {/* Type selection */}
        <Text style={s.sectionLabel}>What happened?</Text>
        <View style={s.tilesGrid}>
          {INCIDENT_TYPES.map((type) => {
            const active = selectedType === type.id;
            return (
              <TouchableOpacity
                key={type.id}
                style={[
                  s.tile,
                  active && { borderColor: type.color, backgroundColor: type.color + '10' },
                ]}
                onPress={() => setSelectedType(type.id)}
                activeOpacity={0.75}
              >
                <Text style={s.tileIcon}>{type.icon}</Text>
                <Text style={[s.tileLabel, active && { color: type.color, fontWeight: '700' }]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Severity */}
        <Text style={s.sectionLabel}>Severity level</Text>
        <View style={s.severityRow}>
          {SEVERITIES.map((sev) => {
            const active = selectedSeverity === sev.id;
            return (
              <TouchableOpacity
                key={sev.id}
                style={[
                  s.severityBtn,
                  active && { borderColor: sev.color, backgroundColor: sev.color + '12' },
                ]}
                onPress={() => setSelectedSeverity(sev.id)}
                activeOpacity={0.75}
              >
                <View style={[s.severityDot, { backgroundColor: sev.color }]} />
                <Text style={[s.severityText, active && { color: sev.color, fontWeight: '700' }]}>
                  {sev.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[s.submitBtn, !selectedType && s.submitBtnOff]}
          onPress={handleSubmit}
          disabled={!selectedType}
          activeOpacity={0.85}
        >
          <Text style={s.submitText}>Submit Report</Text>
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
    gap: 12, paddingTop: 8, marginBottom: 24,
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

  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: colors.textSecondary,
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12,
  },

  tilesGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 10, marginBottom: 28,
  },
  tile: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tileIcon:  { fontSize: 28 },
  tileLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' },

  severityRow: { flexDirection: 'row', gap: 10, marginBottom: 32 },
  severityBtn: {
    flex: 1, paddingVertical: 13,
    borderRadius: 12, borderWidth: 1.5,
    borderColor: colors.cardBorder,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface,
    flexDirection: 'row', gap: 6,
  },
  severityDot:  { width: 8, height: 8, borderRadius: 4 },
  severityText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },

  submitBtn: {
    backgroundColor: colors.brand, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: colors.brand, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28, shadowRadius: 8, elevation: 4,
  },
  submitBtnOff: { opacity: 0.4 },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  centeredWrap: {
    flex: 1, alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 32,
  },
  successCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.safe,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
    shadowColor: colors.safe, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  successCheck: { color: '#FFFFFF', fontSize: 44, fontWeight: '300' },
  successTitle: {
    fontSize: 26, fontWeight: '800',
    color: colors.textPrimary, marginBottom: 10,
  },
  successSub: {
    fontSize: 15, color: colors.textSecondary,
    textAlign: 'center', lineHeight: 22, marginBottom: 36,
  },
  doneBtn: {
    backgroundColor: colors.brand, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 56,
  },
  doneBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  loadingText: {
    marginTop: 20, fontSize: 16, color: colors.textSecondary,
  },
});
