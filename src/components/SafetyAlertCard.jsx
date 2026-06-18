/**
 * SafetyAlertCard — Displays a Gemini-generated Dynamic Safety Alert.
 *
 * Rendered as a lightweight overlay card inside NavigationScreen.
 * Does NOT block the map or interrupt navigation.
 * Supports three severity levels: low (green), medium (orange), high (red).
 * Shows a loading skeleton while Gemini is generating.
 * Dismissable by the user.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';

// ─── Severity config ──────────────────────────────────────────────────────────
const SEVERITY_CONFIG = {
  high: {
    bg:          '#FEF2F2',
    border:      '#FECACA',
    iconBg:      '#FEE2E2',
    iconColor:   '#DC2626',
    titleColor:  '#991B1B',
    bodyColor:   '#7F1D1D',
    badgeBg:     '#DC2626',
    badgeText:   '#FFFFFF',
    label:       'HIGH',
    icon:        '⚠',
  },
  medium: {
    bg:          '#FFFBEB',
    border:      '#FDE68A',
    iconBg:      '#FEF3C7',
    iconColor:   '#D97706',
    titleColor:  '#92400E',
    bodyColor:   '#78350F',
    badgeBg:     '#F59E0B',
    badgeText:   '#FFFFFF',
    label:       'MEDIUM',
    icon:        '⚠',
  },
  low: {
    bg:          '#F0FDF4',
    border:      '#BBF7D0',
    iconBg:      '#DCFCE7',
    iconColor:   '#16A34A',
    titleColor:  '#166534',
    bodyColor:   '#14532D',
    badgeBg:     '#22C55E',
    badgeText:   '#FFFFFF',
    label:       'LOW',
    icon:        '✦',
  },
};

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function LoadingSkeleton() {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <View style={styles.loadingCard}>
      {/* Icon placeholder */}
      <Animated.View style={[styles.loadingIcon, { opacity: pulse }]} />

      {/* Text placeholders */}
      <View style={styles.loadingBody}>
        <View style={styles.loadingRow}>
          <Animated.View style={[styles.loadingLine, styles.loadingLineTall, { opacity: pulse }]} />
          <Animated.View style={[styles.loadingBadge, { opacity: pulse }]} />
        </View>
        <Animated.View style={[styles.loadingLine, styles.loadingLineShort, { opacity: pulse }]} />
        <Animated.View style={[styles.loadingLine, styles.loadingLineMedium, { opacity: pulse }]} />
      </View>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
/**
 * @param {object}   props
 * @param {boolean}  props.visible     - Whether the card is shown at all
 * @param {boolean}  props.loading     - Show skeleton while Gemini generates
 * @param {object}   props.alert       - { severity, title, message }
 * @param {function} props.onDismiss   - Called when user taps ✕
 */
export default function SafetyAlertCard({ visible, loading, alert, onDismiss }) {
  // Slide-in animation
  const slideY = useRef(new Animated.Value(-20)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Animate in
      Animated.parallel([
        Animated.timing(slideY,  { toValue: 0, duration: 320, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      ]).start();
    } else {
      // Reset for next show
      slideY.setValue(-20);
      opacity.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Animated.View style={[styles.wrapper, { opacity, transform: [{ translateY: slideY }] }]}>
        <LoadingSkeleton />
      </Animated.View>
    );
  }

  if (!alert) return null;

  const cfg = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.medium;

  return (
    <Animated.View style={[styles.wrapper, { opacity, transform: [{ translateY: slideY }] }]}>
      <View style={[styles.card, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>

        {/* ── Icon ── */}
        <View style={[styles.iconWrap, { backgroundColor: cfg.iconBg }]}>
          <Text style={[styles.iconText, { color: cfg.iconColor }]}>{cfg.icon}</Text>
        </View>

        {/* ── Content ── */}
        <View style={styles.content}>

          {/* Title row with severity badge */}
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: cfg.titleColor }]} numberOfLines={2}>
              {alert.title}
            </Text>
            <View style={[styles.badge, { backgroundColor: cfg.badgeBg }]}>
              <Text style={[styles.badgeText, { color: cfg.badgeText }]}>{cfg.label}</Text>
            </View>
          </View>

          {/* Message */}
          <Text style={[styles.message, { color: cfg.bodyColor }]}>
            {alert.message}
          </Text>

          {/* Source label */}
          <Text style={styles.source}>✦ AegisPath AI · Dynamic Safety Alert</Text>
        </View>

        {/* ── Dismiss button ── */}
        <TouchableOpacity
          style={styles.dismissBtn}
          onPress={onDismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Text style={[styles.dismissIcon, { color: cfg.titleColor }]}>✕</Text>
        </TouchableOpacity>

      </View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Positioned by NavigationScreen — wrapper just handles animation
  wrapper: {
    width: '100%',
  },

  card: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },

  // ── Icon ──
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  iconText: {
    fontSize: 17,
    fontWeight: '800',
  },

  // ── Content ──
  content: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
    lineHeight: 17,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  message: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    marginBottom: 5,
  },
  source: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },

  // ── Dismiss ──
  dismissBtn: {
    flexShrink: 0,
    marginTop: 1,
    padding: 2,
  },
  dismissIcon: {
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Loading skeleton ──
  loadingCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  loadingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    flexShrink: 0,
  },
  loadingBody: {
    flex: 1,
    gap: 7,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  loadingLine: {
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
  },
  loadingLineTall: {
    height: 13,
    flex: 1,
  },
  loadingLineShort: {
    height: 11,
    width: '85%',
  },
  loadingLineMedium: {
    height: 11,
    width: '70%',
  },
  loadingBadge: {
    width: 42,
    height: 18,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
    flexShrink: 0,
  },
});
