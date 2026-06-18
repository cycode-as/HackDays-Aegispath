/**
 * TimeImpactScreen — Predictive time-based safety advisory.
 *
 * Distinct from Risk Analysis (which shows current dangers).
 * This screen answers: "WHEN should I travel for maximum safety?"
 *
 * Features:
 * - Hourly safety forecast bar chart (6AM → 12AM)
 * - Best / Worst departure time windows
 * - Day vs Night score comparison cards
 * - Smart travel recommendation
 * - Crowd & activity pattern changes by time
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { calcRiskScore } from '../utils/calcRiskScore';
import { colors, getRiskColor } from '../config/colors';

// ─── Generate hourly safety scores for a route zone ──────────────────────────
function buildHourlyForecast(zone) {
  const hours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0];
  return hours.map(h => {
    const { safetyScore, riskLevel } = calcRiskScore(zone, h);
    return { hour: h, safetyScore, riskLevel };
  });
}

function formatHour(h) {
  if (h === 0)  return '12 am';
  if (h < 12)   return `${h} am`;
  if (h === 12) return '12 pm';
  return `${h - 12} pm`;
}

function getTimeWindow(hour) {
  if (hour >= 6  && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 20) return 'Evening';
  if (hour >= 20 && hour < 22) return 'Night';
  return 'Late Night';
}

function getCrowdPattern(hour) {
  if (hour >= 7  && hour < 10) return { label: 'Rush hour — busy streets', icon: '🚶‍♀️', safe: true };
  if (hour >= 10 && hour < 17) return { label: 'Active commercial hours', icon: '🏪', safe: true };
  if (hour >= 17 && hour < 20) return { label: 'Evening crowd — moderate', icon: '👥', safe: true };
  if (hour >= 20 && hour < 22) return { label: 'Thinning crowd — caution', icon: '⚠️', safe: false };
  return { label: 'Isolated — high caution', icon: '🌑', safe: false };
}

// ─── Contextual confidence explanation for a given hour + route ──────────────
function getHourlyExplanation(hour, zone, route) {
  const cautionPOI = route?.confidenceFactors?.cautionPOI ?? 0;
  const safePOI    = route?.confidenceFactors?.safePOI    ?? 0;
  const incident   = route?.confidenceFactors?.incident   ?? 0;

  const isDeepNight   = hour >= 22 || hour < 5;
  const isLateEvening = hour >= 20;
  const isMorning     = hour >= 6 && hour < 10;
  const isMarketHours = hour >= 10 && hour < 18;

  if (isDeepNight && cautionPOI >= 2)
    return 'Confidence drops — nightlife venues active, reduced natural surveillance';
  if (isDeepNight)
    return 'Confidence drops after 11 PM due to reduced visibility and foot traffic';
  if (isLateEvening && cautionPOI >= 1)
    return 'Evening nightlife activity begins — caution zone pressure increases';
  if (isLateEvening)
    return 'Confidence reduces as crowds thin and lighting becomes less reliable';
  if (isMorning && safePOI >= 3)
    return 'Higher confidence — active commuter hours with commercial activity';
  if (isMarketHours && safePOI >= 4)
    return 'Higher confidence during active market hours — natural surveillance peaks';
  if (isMarketHours)
    return 'Daytime confidence — commercial activity and foot traffic at peak';
  if (incident >= 20)
    return 'Elevated contextual signals in this zone — stay aware regardless of time';
  return 'Moderate confidence — standard environmental conditions';
}

// ─── Animated bar for the forecast chart ─────────────────────────────────────
function ForecastBar({ safetyScore, riskLevel, hour, index, isSelected }) {
  const height = useSharedValue(0);
  const MAX_BAR_HEIGHT = 80;

  useEffect(() => {
    height.value = withDelay(
      index * 40,
      withTiming((safetyScore / 100) * MAX_BAR_HEIGHT, { duration: 500 }),
    );
  }, [safetyScore]);

  const animStyle = useAnimatedStyle(() => ({ height: height.value }));
  const barColor = getRiskColor(riskLevel);

  return (
    <View style={bar.col}>
      <View style={bar.track}>
        <Animated.View style={[bar.fill, animStyle, { backgroundColor: barColor }]} />
      </View>
      <Text style={[bar.label, isSelected && bar.labelSelected]}>
        {formatHour(hour)}
      </Text>
      {isSelected && <View style={bar.dot} />}
    </View>
  );
}

const bar = StyleSheet.create({
  col: {
    alignItems: 'center',
    flex: 1,
  },
  track: {
    width: 10,
    height: 80,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  fill: {
    width: '100%',
    borderRadius: 999,
  },
  label: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '500',
  },
  labelSelected: {
    color: colors.brand,
    fontWeight: '800',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.brand,
    marginTop: 2,
  },
});

// ─── TimeImpactScreen ─────────────────────────────────────────────────────────
export default function TimeImpactScreen({ navigation, route: navRoute }) {
  const route = navRoute?.params?.route;

  // Fallback zone if no route passed
  const zone = route?.zone ?? {
    crimeLevel: 15,
    crowdLevel: 'busy',
    infraLevel: 'full',
  };
  const routeLabel = route ? `${route.emoji} ${route.label} Route` : 'This Route';
  const currentHour = route?.timeHour ?? 21;

  const forecast = buildHourlyForecast(zone);

  // Best and worst windows
  const best  = forecast.reduce((a, b) => a.safetyScore >= b.safetyScore ? a : b);
  const worst = forecast.reduce((a, b) => a.safetyScore <= b.safetyScore ? a : b);

  // Day vs Night comparison
  const dayScore   = calcRiskScore(zone, 14);
  const nightScore = calcRiskScore(zone, 21);

  // Smart recommendation — contextual to route POI data
  const cautionPOI = route?.confidenceFactors?.cautionPOI ?? 0;
  const safePOI    = route?.confidenceFactors?.safePOI    ?? 0;
  const incident   = route?.confidenceFactors?.incident   ?? 0;

  let recommendation;
  if (cautionPOI >= 2 && worst.hour >= 20) {
    recommendation = `Avoid travelling after ${formatHour(worst.hour)} — nightlife activity on this route reduces Safety Confidence significantly. Best window: ${formatHour(best.hour)} (score: ${best.safetyScore}).`;
  } else if (safePOI >= 4 && best.safetyScore >= 75) {
    recommendation = `Travel between ${formatHour(best.hour)} for the highest confidence. Active commercial zones along this route provide natural surveillance during ${getTimeWindow(best.hour).toLowerCase()} hours.`;
  } else if (incident >= 20) {
    recommendation = `This zone has elevated contextual signals. Prefer ${formatHour(best.hour)} (score: ${best.safetyScore}) and avoid ${formatHour(worst.hour)} when environmental confidence is lowest.`;
  } else if (best.safetyScore >= 80) {
    recommendation = `Travel between ${formatHour(best.hour)} for the safest experience. Safety Confidence peaks at ${best.safetyScore}.`;
  } else {
    recommendation = `Avoid travelling after ${formatHour(worst.hour)}. Consider the ${formatHour(best.hour)} window instead (score: ${best.safetyScore}).`;
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={s.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={s.headerText}>
            <Text style={s.title}>Time-Based Safety</Text>
            <Text style={s.subtitle}>Predictive AI analysis</Text>
          </View>
        </View>

        <Text style={s.routeTag}>{routeLabel}</Text>
        <Text style={s.intro}>
          Safety levels along this route shift dramatically by time of day.
        </Text>

        {/* ── Day vs Night cards ── */}
        <View style={s.modeRow}>
          <View style={[s.modeCard, { backgroundColor: '#F0FFF4', borderColor: colors.safe }]}>
            <View style={[s.modeIcon, { backgroundColor: colors.safe }]}>
              <Text style={s.modeEmoji}>☀️</Text>
            </View>
            <Text style={s.modeTrend}>↗</Text>
            <Text style={s.modeTitle}>Day Mode</Text>
            <Text style={s.modeTime}>6 AM – 7 PM</Text>
            <View style={s.modeScoreRow}>
              <Text style={[s.modeScore, { color: colors.safe }]}>{dayScore.safetyScore}</Text>
              <View style={[s.modeBadge, { backgroundColor: colors.safe }]}>
                <Text style={s.modeBadgeText}>SAFE</Text>
              </View>
            </View>
          </View>

          <View style={[s.modeCard, { backgroundColor: '#FFF5F5', borderColor: colors.highRisk }]}>
            <View style={[s.modeIcon, { backgroundColor: colors.highRisk }]}>
              <Text style={s.modeEmoji}>🌙</Text>
            </View>
            <Text style={[s.modeTrend, { color: colors.highRisk }]}>↘</Text>
            <Text style={s.modeTitle}>Night Mode</Text>
            <Text style={s.modeTime}>7 PM – 6 AM</Text>
            <View style={s.modeScoreRow}>
              <Text style={[s.modeScore, { color: colors.highRisk }]}>{nightScore.safetyScore}</Text>
              <View style={[s.modeBadge, { backgroundColor: colors.highRisk }]}>
                <Text style={s.modeBadgeText}>
                  {nightScore.riskLevel === 'HIGH' ? 'RISKY' : nightScore.riskLevel}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Hourly forecast chart ── */}
        <View style={s.chartCard}>
          <View style={s.chartHeader}>
            <View>
              <Text style={s.chartLabel}>TODAY</Text>
              <Text style={s.chartTitle}>Hourly Safety Forecast</Text>
            </View>
            <View style={s.liveBadge}>
              <Text style={s.liveBadgeText}>Live</Text>
            </View>
          </View>

          <View style={s.chartBars}>
            {forecast.map((item, i) => (
              <ForecastBar
                key={item.hour}
                safetyScore={item.safetyScore}
                riskLevel={item.riskLevel}
                hour={item.hour}
                index={i}
                isSelected={item.hour === currentHour}
              />
            ))}
          </View>
        </View>

        {/* ── Best & Worst windows ── */}
        <View style={s.windowRow}>
          <View style={[s.windowCard, { backgroundColor: colors.safeLight }]}>
            <Text style={s.windowIcon}>✅</Text>
            <Text style={s.windowLabel}>Best Window</Text>
            <Text style={[s.windowTime, { color: colors.safe }]}>
              {getTimeWindow(best.hour)}
            </Text>
            <Text style={s.windowHour}>{formatHour(best.hour)}</Text>
            <Text style={[s.windowScore, { color: colors.safe }]}>Score: {best.safetyScore}</Text>
          </View>

          <View style={[s.windowCard, { backgroundColor: colors.riskLight }]}>
            <Text style={s.windowIcon}>⚠️</Text>
            <Text style={s.windowLabel}>Avoid Window</Text>
            <Text style={[s.windowTime, { color: colors.highRisk }]}>
              {getTimeWindow(worst.hour)}
            </Text>
            <Text style={s.windowHour}>{formatHour(worst.hour)}</Text>
            <Text style={[s.windowScore, { color: colors.highRisk }]}>Score: {worst.safetyScore}</Text>
          </View>
        </View>

        {/* ── Crowd & activity patterns ── */}
        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>Crowd & Activity Patterns</Text>
          {[6, 9, 14, 19, 21, 23].map(h => {
            const pattern = getCrowdPattern(h);
            const { safetyScore } = calcRiskScore(zone, h);
            const explanation = getHourlyExplanation(h, zone, route);
            const isCurrentHour = h === currentHour;
            return (
              <View key={h} style={[s.patternRow, isCurrentHour && s.patternRowActive]}>
                <View style={[s.patternIconWrap, { backgroundColor: pattern.safe ? colors.safeLight : colors.riskLight }]}>
                  <Text style={s.patternIcon}>{pattern.icon}</Text>
                </View>
                <View style={s.patternText}>
                  <Text style={s.patternTime}>
                    {formatHour(h)} — {getTimeWindow(h)}
                    {isCurrentHour ? '  ·  NOW' : ''}
                  </Text>
                  <Text style={s.patternLabel}>{pattern.label}</Text>
                  <Text style={s.patternExplanation} numberOfLines={2}>{explanation}</Text>
                </View>
                <Text style={[s.patternScore, { color: getRiskColor(safetyScore >= 80 ? 'LOW' : safetyScore >= 50 ? 'MODERATE' : 'HIGH') }]}>
                  {safetyScore}
                </Text>
              </View>
            );
          })}
        </View>

        {/* ── Smart recommendation ── */}
        <View style={s.recommendCard}>
          <Text style={s.recommendIcon}>🤖</Text>
          <Text style={s.recommendTitle}>AegisPath Recommendation</Text>
          <Text style={s.recommendText}>{recommendation}</Text>
        </View>

        {/* ── CTA ── */}
        <TouchableOpacity
          style={s.cta}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
        >
          <Text style={s.ctaText}>Back to Route Comparison</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    flexShrink: 0,
  },
  backIcon: { fontSize: 18, color: '#0F172A' },
  headerText: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 1 },

  routeTag: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.brand,
    marginBottom: 4,
  },
  intro: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 20,
  },

  /* Day / Night mode cards */
  modeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  modeCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
  },
  modeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  modeEmoji: { fontSize: 18 },
  modeTrend: {
    position: 'absolute',
    top: 12,
    right: 12,
    fontSize: 16,
    fontWeight: '800',
    color: colors.safe,
  },
  modeTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
  modeTime:  { fontSize: 11, color: '#64748B', marginBottom: 8 },
  modeScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modeScore: { fontSize: 28, fontWeight: '900' },
  modeBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  modeBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },

  /* Forecast chart */
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  chartLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  liveBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.brand,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },

  /* Best / Worst windows */
  windowRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  windowCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
  },
  windowIcon: { fontSize: 22, marginBottom: 4 },
  windowLabel: { fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 4 },
  windowTime: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  windowHour: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 2 },
  windowScore: { fontSize: 12, fontWeight: '600' },

  /* Crowd patterns */
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
  },
  patternRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  patternRowActive: {
    backgroundColor: '#F0F4FF',
    borderRadius: 10,
    marginHorizontal: -4,
    paddingHorizontal: 4,
  },
  patternIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  patternIcon: { fontSize: 16 },
  patternText: { flex: 1 },
  patternTime: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  patternLabel: { fontSize: 11, color: '#64748B', marginTop: 1 },
  patternExplanation: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
    lineHeight: 14,
    fontStyle: 'italic',
  },
  patternScore: { fontSize: 16, fontWeight: '800', flexShrink: 0 },

  /* AI recommendation */
  recommendCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  recommendIcon: { fontSize: 24, flexShrink: 0 },
  recommendTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#94A3B8',
    marginBottom: 4,
  },
  recommendText: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
    flex: 1,
  },

  /* CTA */
  cta: {
    backgroundColor: colors.brand,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
