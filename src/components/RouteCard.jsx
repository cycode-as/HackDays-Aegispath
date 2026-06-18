import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import ScoreBar from './ScoreBar';
import ConfidencePill from './ConfidencePill';
import { colors, getRiskColor } from '../config/colors';

// ─── Derive up to 2 contextual explanation chips ──────────────────────────────
function getExplanationChips(route) {
  const {
    safetyScore = 50,
    confidenceFactors = {},
    confidenceTags = [],
    timeHour = 14,
    factors = {},
  } = route;

  const chips = [];
  const isNight     = timeHour >= 20 || timeHour < 6;
  const cautionPOI  = confidenceFactors.cautionPOI ?? 0;
  const safePOI     = confidenceFactors.safePOI    ?? 0;
  const incidentVal = confidenceFactors.incident   ?? factors.crime ?? 0;
  const emergency   = confidenceFactors.emergency  ?? 0;
  const isolation   = confidenceFactors.isolation  ?? 0;
  const crowd       = confidenceFactors.crowd      ?? 0;

  if (cautionPOI >= 2 && isNight)
    chips.push({ label: 'Nightlife-heavy area', type: 'caution', icon: '⚠' });
  else if (cautionPOI >= 3)
    chips.push({ label: 'Nightlife-heavy area', type: 'caution', icon: '⚠' });

  if (incidentVal >= 20)
    chips.push({ label: 'Incident zone nearby', type: 'caution', icon: '⚠' });

  if (chips.length < 2) {
    if (safePOI >= 5 || confidenceTags.includes('Active commercial zone'))
      chips.push({ label: 'Commercial corridor', type: 'safe', icon: '✦' });
    else if (emergency >= 50)
      chips.push({ label: 'Emergency access', type: 'safe', icon: '✦' });
    else if (isolation < 20 && crowd >= 50)
      chips.push({ label: 'Lower isolation risk', type: 'safe', icon: '✦' });
    else if (safetyScore >= 65)
      chips.push({ label: 'Safe corridor', type: 'safe', icon: '✦' });
  }

  if (chips.length < 2) {
    if (isolation >= 40)
      chips.push({ label: 'Isolated stretches', type: 'caution', icon: '⚠' });
    else if (isNight && safetyScore < 50)
      chips.push({ label: 'Late-night risk', type: 'caution', icon: '⚠' });
    else if (emergency >= 50 && chips.every(c => c.label !== 'Emergency access'))
      chips.push({ label: 'Emergency access', type: 'safe', icon: '✦' });
  }

  return chips.slice(0, 2);
}

// ─── Derive up to 3 compact POI chips ────────────────────────────────────────
function getPOIChips(route) {
  const { confidenceFactors = {}, isRecommended = false } = route;
  const safePOI    = confidenceFactors.safePOI    ?? 0;
  const cautionPOI = confidenceFactors.cautionPOI ?? 0;
  const emergency  = confidenceFactors.emergency  ?? 0;
  const isolation  = confidenceFactors.isolation  ?? 0;

  const chips = [];

  if (isRecommended) {
    // Safe route — show positive POI signals
    if (safePOI >= 4)
      chips.push({ label: `${safePOI} Safe Venues`, safe: true, icon: '🏪' });
    else if (safePOI >= 1)
      chips.push({ label: 'Public Activity', safe: true, icon: '🏪' });
    if (emergency >= 50)
      chips.push({ label: 'Police Nearby', safe: true, icon: '🚔' });
    if (isolation < 20)
      chips.push({ label: 'Well-Populated', safe: true, icon: '👥' });
    else if (cautionPOI === 0)
      chips.push({ label: 'No Nightlife', safe: true, icon: '✅' });
  } else {
    // Alternative route — show caution signals
    if (cautionPOI >= 2)
      chips.push({ label: `${cautionPOI} Nightlife Spots`, safe: false, icon: '🍺' });
    else if (cautionPOI === 1)
      chips.push({ label: 'Nightlife Area', safe: false, icon: '🍺' });
    if (isolation >= 40)
      chips.push({ label: 'Isolated Stretch', safe: false, icon: '🛤' });
    if (emergency < 30)
      chips.push({ label: 'Low Emergency Access', safe: false, icon: '⚠' });
    else if (safePOI >= 3)
      chips.push({ label: `${safePOI} Safe Venues`, safe: true, icon: '🏪' });
  }

  return chips.slice(0, 3);
}

export default function RouteCard({ route, onSeeWhy, onNavigate, onTimeImpact }) {
  const {
    label, emoji, duration, distance,
    safetyScore, riskLevel, narrative,
    badges, isRecommended,
  } = route;

  const scoreColor = getRiskColor(riskLevel);
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    const steps = 20;
    let count = 0;
    const interval = setInterval(() => {
      count++;
      setDisplayScore(Math.min(Math.round((safetyScore / steps) * count), safetyScore));
      if (count >= steps) clearInterval(interval);
    }, 500 / steps);
    return () => clearInterval(interval);
  }, [safetyScore]);

  const explanationChips = getExplanationChips(route);
  const poiChips         = getPOIChips(route);

  return (
    <View style={[
      styles.card,
      isRecommended ? styles.cardRecommended : styles.cardAlternative,
    ]}>

      {/* Recommended / Alternative tag */}
      <View style={[styles.recTag, isRecommended ? styles.recTagSafe : styles.recTagAlt]}>
        <Text style={styles.recTagText}>
          {isRecommended ? '✓ RECOMMENDED — SAFER ROUTE' : '📍 ALTERNATIVE ROUTE'}
        </Text>
      </View>

      {/* Top row: icon + label + score */}
      <View style={styles.topRow}>
        <View style={[styles.iconWrap, isRecommended ? styles.iconSafe : styles.iconAlt]}>
          <Text style={styles.iconEmoji}>{emoji}</Text>
        </View>
        <View style={styles.routeInfo}>
          <Text style={styles.routeLabel} numberOfLines={1}>{label} Route</Text>
          <Text style={styles.metaText}>🕐 {duration}  ·  {distance}</Text>
        </View>
        <View style={styles.scoreBlock}>
          <Text style={styles.safetyLabel}>Safety Confidence</Text>
          <Text style={[styles.scoreNum, { color: scoreColor }]}>{displayScore}</Text>
        </View>
      </View>

      {/* Animated score bar */}
      <ScoreBar safetyScore={safetyScore} riskLevel={riskLevel} />

      {/* ── Contextual explanation chips ── */}
      {explanationChips.length > 0 && (
        <View style={styles.chipRow}>
          {explanationChips.map((chip, i) => {
            const isCaution = chip.type === 'caution';
            return (
              <View key={i} style={[styles.chip, isCaution ? styles.chipCaution : styles.chipSafe]}>
                <Text style={[styles.chipText, isCaution ? styles.chipTextCaution : styles.chipTextSafe]}>
                  {chip.icon} {chip.label}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* ── POI chips — compact, max 3 ── */}
      {poiChips.length > 0 && (
        <View style={styles.poiRow}>
          {poiChips.map((chip, i) => (
            <View key={i} style={[styles.poiChip, chip.safe ? styles.poiChipSafe : styles.poiChipCaution]}>
              <Text style={styles.poiChipIcon}>{chip.icon}</Text>
              <Text style={[styles.poiChipText, chip.safe ? styles.poiChipTextSafe : styles.poiChipTextCaution]}>
                {chip.label}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Narrative preview */}
      <Text style={styles.narrative} numberOfLines={2}>{narrative}</Text>

      {/* Confidence badges */}
      <View style={styles.badgeRow}>
        {badges.map((b, i) => (
          <ConfidencePill key={i} icon={b.icon} label={b.label} type={b.type} />
        ))}
      </View>

      {/* ── Action buttons ── */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.riskBtn} onPress={() => onSeeWhy(route)} activeOpacity={0.75}>
          <Text style={styles.riskBtnText} numberOfLines={1}>See Why →</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.timeBtn} onPress={() => onTimeImpact && onTimeImpact(route)} activeOpacity={0.75}>
          <Text style={styles.timeBtnText} numberOfLines={1}>🕐 Time Impact</Text>
        </TouchableOpacity>
      </View>

      {/* Navigate — full width */}
      <TouchableOpacity
        style={[styles.navBtn, isRecommended ? styles.navBtnPrimary : styles.navBtnSecondary]}
        onPress={() => onNavigate(route)}
        activeOpacity={0.85}
      >
        <Text style={[styles.navBtnText, isRecommended ? styles.navBtnTextPrimary : styles.navBtnTextSecondary]} numberOfLines={1}>
          {isRecommended ? '✓ Navigate Safer Route →' : 'Navigate This Route →'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardRecommended: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FFF4',
    shadowColor: '#16A34A',
    shadowOpacity: 0.18,
    elevation: 5,
  },
  cardAlternative: {
    borderColor: '#DC2626',
    backgroundColor: '#FFF5F5',
    shadowColor: '#DC2626',
    shadowOpacity: 0.10,
    elevation: 3,
  },

  recTag: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  recTagSafe: { backgroundColor: '#16A34A' },
  recTagAlt:  { backgroundColor: '#DC2626' },
  recTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconSafe: { backgroundColor: '#DCFCE7' },
  iconAlt:  { backgroundColor: '#FEE2E2' },
  iconEmoji: { fontSize: 22 },

  routeInfo: { flex: 1, minWidth: 0 },
  routeLabel: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 3 },
  metaText:   { fontSize: 12, color: '#64748B' },

  scoreBlock: { alignItems: 'flex-end', flexShrink: 0 },
  safetyLabel: { fontSize: 9, fontWeight: '700', color: '#64748B', letterSpacing: 0.3 },
  scoreNum:    { fontSize: 30, fontWeight: '800', lineHeight: 34 },

  // Explanation chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: 2 },
  chip:        { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipSafe:    { backgroundColor: '#EEF2FF' },
  chipCaution: { backgroundColor: '#FFF7ED' },
  chipText:        { fontSize: 11, fontWeight: '600' },
  chipTextSafe:    { color: '#3B5BDB' },
  chipTextCaution: { color: '#92400E' },

  // POI chips
  poiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6, marginBottom: 4 },
  poiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  poiChipSafe:    { backgroundColor: '#DCFCE7' },
  poiChipCaution: { backgroundColor: '#FEE2E2' },
  poiChipIcon: { fontSize: 12 },
  poiChipText:        { fontSize: 11, fontWeight: '700' },
  poiChipTextSafe:    { color: '#15803D' },
  poiChipTextCaution: { color: '#B91C1C' },

  narrative: { fontSize: 13, color: '#64748B', lineHeight: 18, marginTop: 8, marginBottom: 10 },

  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 14 },

  actionsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },

  riskBtn: {
    flex: 1, backgroundColor: '#FEE2E2', borderRadius: 10,
    paddingVertical: 11, alignItems: 'center', justifyContent: 'center',
  },
  riskBtnText: { fontSize: 12, fontWeight: '700', color: '#B91C1C' },

  timeBtn: {
    flex: 1, backgroundColor: '#FEF3C7', borderRadius: 10,
    paddingVertical: 11, alignItems: 'center', justifyContent: 'center',
  },
  timeBtnText: { fontSize: 12, fontWeight: '700', color: '#92400E' },

  navBtn: { borderRadius: 10, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  navBtnPrimary:   { backgroundColor: '#16A34A' },
  navBtnSecondary: { backgroundColor: '#FEE2E2' },
  navBtnText:          { fontSize: 14, fontWeight: '700' },
  navBtnTextPrimary:   { color: '#FFFFFF' },
  navBtnTextSecondary: { color: '#B91C1C' },
});
