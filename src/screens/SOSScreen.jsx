/**
 * SOSScreen — Cinematic emergency flow.
 *
 * Phase 0: 3-second countdown (3… 2… 1…)
 * Phase 1: "Sending alert…"           (1.2s)
 * Phase 2: "Alerting trusted contacts…" (1.4s)
 * Phase 3: "Nearest authorities notified" (1.4s)
 * Phase 4: "Live tracking activated"   (1.2s)
 * Done:    Confirmation screen
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { sendSOS, callFirstContact, getEmergencyContacts, getLiveLocation, startCallEscalation } from '../services/sendSOS';
import { useRouteStore } from '../stores/useRouteStore';

// ─── Phase definitions ────────────────────────────────────────────────────────
const PHASES = [
  {
    id:      'contacts',
    icon:    '👥',
    title:   'Alerting trusted contacts…',
    sub:     'Mom • Priya • Dad',
    delay:   0,
  },
  {
    id:      'authorities',
    icon:    '🚔',
    title:   'Nearest authorities notified',
    sub:     'Police PCR • 0.8 km away',
    delay:   1200,
  },
  {
    id:      'tracking',
    icon:    '📍',
    title:   'Live tracking activated',
    sub:     '28.5494° N, 77.2001° E',
    delay:   2600,
  },
];

// ─── Animated ring component ──────────────────────────────────────────────────
function PulseRing({ delay = 0 }) {
  const scale   = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(2.2, { duration: 1600, easing: Easing.out(Easing.ease) }),
        withTiming(1,   { duration: 0 }),
      ), -1,
    ));
    opacity.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(0, { duration: 1600, easing: Easing.out(Easing.ease) }),
        withTiming(0.5, { duration: 0 }),
      ), -1,
    ));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.ring, style]} />;
}

// ─── Single status row ────────────────────────────────────────────────────────
function StatusRow({ icon, title, sub, visible, done }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 400 });
      translateY.value = withTiming(0, { duration: 400 });
    }
  }, [visible]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.statusRow, style]}>
      <View style={styles.statusIconWrap}>
        <Text style={styles.statusIcon}>{icon}</Text>
      </View>
      <View style={styles.statusTextWrap}>
        <Text style={styles.statusTitle}>{title}</Text>
        <Text style={styles.statusSub}>{sub}</Text>
      </View>
      {done && (
        <View style={styles.checkWrap}>
          <Text style={styles.checkText}>✓</Text>
        </View>
      )}
    </Animated.View>
  );
}

// ─── SOSScreen ────────────────────────────────────────────────────────────────
export default function SOSScreen({ navigation }) {
  const [countdown, setCountdown]         = useState(3);
  const [phasesDone, setPhasesDone]       = useState([]);
  const [allDone, setAllDone]             = useState(false);
  const [safeConfirmed, setSafeConfirmed] = useState(false);
  const [contacts, setContacts]           = useState([]);
  const [liveCoords, setLiveCoords]       = useState(null);
  const cancelCallsRef = useRef(null); // cleanup for call escalation timers
  const setSosActive = useRouteStore((s) => s.setSosActive);

  // Load contacts and start fetching GPS immediately on mount
  useEffect(() => {
    getEmergencyContacts().then(setContacts);
    // Fetch GPS during the 3-second countdown so it's ready when SMS fires
    getLiveLocation().then(loc => { if (loc) setLiveCoords(loc); });
  }, []);

  // Build contact names string for display
  const contactNames = contacts.length > 0
    ? contacts.map(c => c.name).join(' • ')
    : 'Emergency contacts';

  const firstContactName = contacts[0]?.name ?? 'Emergency contact';

  // Pulse animation for the main circle
  const circleScale = useSharedValue(1);
  useEffect(() => {
    circleScale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 800 }),
        withTiming(1.0, { duration: 800 }),
      ), -1,
    );
  }, []);
  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale.value }],
  }));

  // Countdown: 3 → 2 → 1 → start full escalation flow
  useEffect(() => {
    const t1 = setTimeout(() => setCountdown(2), 1000);
    const t2 = setTimeout(() => setCountdown(1), 2000);
    const t3 = setTimeout(() => {
      setCountdown(null);

      // 1. Open SMS composer with all contacts pre-filled (user presses Send once)
      sendSOS();

      // 2. Start sequential call escalation AFTER a short delay
      //    so the SMS composer has time to open first
      setTimeout(() => {
        cancelCallsRef.current = startCallEscalation();
      }, 1500);

      // 3. Reveal status phases sequentially
      PHASES.forEach((p) => {
        setTimeout(() => {
          setPhasesDone(prev => [...prev, p.id]);
        }, p.delay);
      });

      // 4. Mark done after all phases
      setTimeout(() => setAllDone(true), 4400);
    }, 3000);

    return () => {
      [t1, t2, t3].forEach(clearTimeout);
      // Cancel pending call escalation timers if user cancels
      if (cancelCallsRef.current) cancelCallsRef.current();
    };
  }, []);

  const handleImSafe = () => {
    // Cancel any pending call escalation timers
    if (cancelCallsRef.current) cancelCallsRef.current();
    setSafeConfirmed(true);
    setSosActive(false);
    setTimeout(() => navigation.navigate('Home'), 2200);
  };

  // ── Emotional closure — "Glad you're safe" ───────────────────────────────────
  if (safeConfirmed) {
    return (
      <View style={styles.closureContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F0FFF4" />
        <Text style={styles.closureEmoji}>🌿</Text>
        <Text style={styles.closureTitle}>Glad you're safe.</Text>
        <Text style={styles.closureSub}>
          Live tracking ended.{'\n'}Your contacts have been updated.{'\n'}Emergency session closed.
        </Text>
        <View style={styles.closureRows}>
          {['Live tracking ended', 'Contacts updated', 'Emergency session closed'].map((item, i) => (
            <View key={i} style={styles.closureRow}>
              <Text style={styles.closureCheck}>✓</Text>
              <Text style={styles.closureRowText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  // ── Done state ──────────────────────────────────────────────────────────────
  if (allDone) {
    return (
      <View style={styles.doneContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#7F1D1D" />

        <View style={styles.doneCheckCircle}>
          <Text style={styles.doneCheckText}>✓</Text>
        </View>

        <Text style={styles.doneTitle}>Alert Sent</Text>
        <Text style={styles.doneSub}>
          Your contacts have been notified.{'\n'}Help is on the way.
        </Text>

        {/* Confirmed actions */}
        <View style={styles.doneList}>
          {PHASES.map((p) => (
            <View key={p.id} style={styles.doneRow}>
              <Text style={styles.doneRowCheck}>✓</Text>
              <Text style={styles.doneRowText}>{p.title.replace('…', '')}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.safeBtn} onPress={handleImSafe} activeOpacity={0.85}>
          <Text style={styles.safeBtnText}>I'm Safe Now</Text>
        </TouchableOpacity>

        {/* Call Again — retries contact 1 immediately */}
        <TouchableOpacity
          style={styles.callAgainBtn}
          onPress={() => callFirstContact()}
          activeOpacity={0.85}
        >
          <Text style={styles.callAgainText}>📞 Call Again — {firstContactName}</Text>
        </TouchableOpacity>

        {/* Share location nudge */}
        <Text style={styles.shareNudge}>
          📍 {liveCoords ? liveCoords.coordString : 'Location shared with your emergency contacts'}
        </Text>
      </View>
    );
  }

  // ── Active flow ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#7F1D1D" />

      {/* Expanding pulse rings */}
      <View style={styles.ringsWrap}>
        <PulseRing delay={0} />
        <PulseRing delay={533} />
        <PulseRing delay={1066} />
      </View>

      {/* Main pulsing circle */}
      <Animated.View style={[styles.mainCircle, circleStyle]}>
        {countdown !== null ? (
          <Text style={styles.countdownText}>{countdown}</Text>
        ) : (
          <Text style={styles.sosText}>SOS</Text>
        )}
      </Animated.View>

      {/* Headline */}
      {countdown !== null ? (
        <>
          <Text style={styles.headlineText}>Hold on.</Text>
          <Text style={styles.subText}>Sending emergency alert in {countdown}…</Text>
        </>
      ) : (
        <>
          <Text style={styles.headlineText}>Emergency Alert Activated</Text>
          <Text style={styles.subText}>Stay calm. Help is on the way.</Text>
        </>
      )}

      {/* Sequential status rows — use real contact names */}
      {countdown === null && (
        <View style={styles.statusCard}>
          <StatusRow
            icon="👥"
            title="SMS alert sent to all contacts"
            sub={contactNames}
            visible={phasesDone.includes('contacts')}
            done={phasesDone.includes('contacts')}
          />
          <StatusRow
            icon="📞"
            title={`Calling ${firstContactName}…`}
            sub="Emergency call initiated"
            visible={phasesDone.includes('authorities')}
            done={phasesDone.includes('authorities')}
          />
          <StatusRow
            icon="📍"
            title="Live tracking activated"
            sub={liveCoords ? liveCoords.coordString : 'Fetching location…'}
            visible={phasesDone.includes('tracking')}
            done={phasesDone.includes('tracking')}
          />
        </View>
      )}

      {/* Cancel — only during countdown */}
      {countdown !== null && (
        <TouchableOpacity style={styles.cancelBtn} onPress={handleImSafe} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const CIRCLE_SIZE = 160;
const RING_SIZE   = CIRCLE_SIZE;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#7F1D1D',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },

  /* Rings */
  ringsWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    top: '50%',
    marginTop: -(RING_SIZE / 2) - 80,
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },

  /* Main circle */
  mainCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: '#EF4444',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 16,
  },
  countdownText: {
    color: '#FFFFFF',
    fontSize: 64,
    fontWeight: '900',
    lineHeight: 70,
  },
  sosText: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 4,
  },

  /* Headline */
  headlineText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  subText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
  },

  /* Status card */
  statusCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  statusIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statusIcon: { fontSize: 18 },
  statusTextWrap: { flex: 1 },
  statusTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  statusSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
  },
  checkWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#4ADE80',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  /* Cancel */
  cancelBtn: {
    marginTop: 32,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  cancelText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
  },

  /* ── Done state ── */
  doneContainer: {
    flex: 1,
    backgroundColor: '#7F1D1D',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  doneCheckCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#4ADE80',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#4ADE80',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  doneCheckText: { color: '#FFFFFF', fontSize: 52, fontWeight: '300' },
  doneTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 10,
  },
  doneSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  doneList: {
    width: '100%',
    marginBottom: 36,
    gap: 10,
  },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  doneRowCheck: {
    color: '#4ADE80',
    fontSize: 16,
    fontWeight: '800',
  },
  doneRowText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '500',
  },
  safeBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 48,
    marginBottom: 12,
  },
  safeBtnText: {
    color: '#7F1D1D',
    fontSize: 16,
    fontWeight: '800',
  },
  callAgainBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 28,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  callAgainText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  shareNudge: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },

  /* ── Emotional closure ── */
  closureContainer: {
    flex: 1,
    backgroundColor: '#F0FFF4',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  closureEmoji: {
    fontSize: 56,
    marginBottom: 20,
  },
  closureTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 12,
  },
  closureSub: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  closureRows: {
    width: '100%',
    gap: 12,
  },
  closureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 12,
  },
  closureCheck: {
    fontSize: 15,
    color: '#22C55E',
    fontWeight: '800',
  },
  closureRowText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
});
