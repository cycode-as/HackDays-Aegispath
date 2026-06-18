/**
 * NavigationScreen — Native Map Navigation
 *
 * Rerouting fixes applied:
 *  - routeVersion counter forces Polyline/Marker key remount on reroute
 *  - activeCoordsRef always holds the current coords (no stale closures)
 *  - dot interval reads length from ref, not closure
 *  - camera follow effect depends on both dotIndex AND routeVersion
 *  - handleReroute reads coords from ref, not stale useCallback closure
 *  - dotIndex reset and coord update are sequenced via routeVersion bump
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Polyline, Marker } from 'react-native-maps';
import * as Haptics from 'expo-haptics';
import SOSButton from '../components/SOSButton';
import ShakeSOSAlert from '../components/ShakeSOSAlert';
import { useShakeToSOS } from '../hooks/useShakeToSOS';
import { colors, getRiskColor } from '../config/colors';
import { useRouteStore } from '../stores/useRouteStore';
import { call112 } from '../services/sendSOS';
import { getAlternativeRoute } from '../services/routingEngine';
import { getNearestPoliceStation } from '../services/policeStationService';
import * as Location from 'expo-location';

function getPolylineColor(riskLevel) {
  if (riskLevel === 'LOW')      return '#22C55E';
  if (riskLevel === 'MODERATE') return '#F59E0B';
  return '#EF4444';
}

// Fixed route colors — green = safer, red = alternative (regardless of risk level)
const PRIMARY_ROUTE_COLOR   = '#16A34A'; // strong green
const SECONDARY_ROUTE_COLOR = '#DC2626'; // strong red

function getRegionForCoords(coords) {
  if (!coords || coords.length === 0) {
    return { latitude: 28.6139, longitude: 77.2090, latitudeDelta: 0.05, longitudeDelta: 0.05 };
  }
  let minLat = coords[0][0], maxLat = coords[0][0];
  let minLon = coords[0][1], maxLon = coords[0][1];
  coords.forEach(([lat, lon]) => {
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
  });
  return {
    latitude:      (minLat + maxLat) / 2,
    longitude:     (minLon + maxLon) / 2,
    latitudeDelta:  (maxLat - minLat) * 1.4 + 0.005,
    longitudeDelta: (maxLon - minLon) * 1.4 + 0.005,
  };
}

export default function NavigationScreen({ navigation }) {
  const {
    routes,
    selectedRoute,
    routeCoords: storeCoords,
    source, destination, destCoords,
    timeMode, travelMode,
    setRouteCoords,
  } = useRouteStore();

  // ── Core state ──────────────────────────────────────────────────────────────
  const [dotIndex,       setDotIndex]       = useState(0);
  const [rerouteCoords,  setRerouteCoords]  = useState(null);
  // routeVersion increments on every successful reroute.
  // Used as `key` on Polyline/Markers to force full remount.
  const [routeVersion,   setRouteVersion]   = useState(0);
  const [arrived,        setArrived]        = useState(false);

  // ── Dual-route selection phase ──────────────────────────────────────────────
  // phase: 'comparing' → show both routes + overlay
  //        'selecting'  → overlay says "Selecting safer route…"
  //        'navigating' → both routes still visible, dot animation running
  const [selectionPhase, setSelectionPhase] = useState('comparing');

  const [alertVisible,   setAlertVisible]   = useState(false);
  const [rerouteVisible, setRerouteVisible] = useState(false);
  const [policeVisible,  setPoliceVisible]  = useState(false);
  const [isRerouting,    setIsRerouting]    = useState(false);
  const [floatAlert,     setFloatAlert]     = useState(null);
  const [policeStation,  setPoliceStation]  = useState(null);
  const [policeLoading,  setPoliceLoading]  = useState(false);
  const [aheadInfo,      setAheadInfo]      = useState(null); // one-line ahead strip

  // ── Refs ────────────────────────────────────────────────────────────────────
  const mapRef            = useRef(null);
  const isMounted         = useRef(true);
  const rerouteInFlight   = useRef(false);
  const intervalRef       = useRef(null);
  // Always-current coords ref — eliminates stale closures in interval + handleReroute
  const activeCoordsRef   = useRef(null);
  // Always-current dotIndex ref — avoids the broken Promise/setState pattern
  const dotIndexRef       = useRef(0);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ── Resolve active coords — rerouteCoords takes priority over store ─────────
  const ROUTE_COORDS = useMemo(() => {
    if (rerouteCoords && rerouteCoords.length >= 2) return rerouteCoords;
    if (storeCoords   && storeCoords.length   >= 2) return storeCoords;
    return null;
  }, [rerouteCoords, storeCoords]);

  // Keep ref in sync with resolved coords — always current, no stale closures
  useEffect(() => {
    activeCoordsRef.current = ROUTE_COORDS;
  }, [ROUTE_COORDS]);

  // Keep dotIndex ref in sync — used by handleReroute to avoid broken Promise pattern
  useEffect(() => {
    dotIndexRef.current = dotIndex;
  }, [dotIndex]);

  // ── Polyline coords for MapView ─────────────────────────────────────────────
  const polylineCoords = useMemo(() => {
    if (!ROUTE_COORDS) return [];
    return ROUTE_COORDS.map(([lat, lon]) => ({ latitude: lat, longitude: lon }));
  }, [ROUTE_COORDS]);

  // ── Zone / color derived from selectedRoute ─────────────────────────────────
  const currentZone = selectedRoute
    ? { name: selectedRoute.label, safetyScore: selectedRoute.safetyScore, riskLevel: selectedRoute.riskLevel }
    : { name: 'Route', safetyScore: 50, riskLevel: 'MODERATE' };
  // Safety bar always green — we're navigating the safest route
  const zoneColor     = PRIMARY_ROUTE_COLOR;
  const polylineColor = PRIMARY_ROUTE_COLOR; // kept for any legacy references

  // ── Shake-to-SOS ────────────────────────────────────────────────────────────
  const { shakeDetected, countdown, cancelShakeSOS } = useShakeToSOS(() => {
    navigation.navigate('SOS');
  });

  // ── Initial map region ──────────────────────────────────────────────────────
  const initialRegion = useMemo(() => getRegionForCoords(ROUTE_COORDS), []);  // intentionally only on mount

  // ── Dot animation interval ──────────────────────────────────────────────────
  // Re-runs whenever ROUTE_COORDS changes (i.e. after reroute).
  // Reads coords length from activeCoordsRef — never stale.
  // Does NOT start until selectionPhase === 'navigating'.
  useEffect(() => {
    if (!ROUTE_COORDS || ROUTE_COORDS.length === 0) return;
    if (selectionPhase !== 'navigating') return;

    // Kill any existing interval immediately
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const stepSize = Math.max(1, Math.floor(ROUTE_COORDS.length / 60));

    intervalRef.current = setInterval(() => {
      const coords = activeCoordsRef.current;
      if (!coords || coords.length === 0) return;
      setDotIndex(prev => {
        const next = prev + stepSize;
        if (next >= coords.length - 1) {
          // Reached destination — stop interval and trigger arrival
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setTimeout(() => {
            if (isMounted.current) setArrived(true);
          }, 600); // small delay so camera settles on destination first
          return coords.length - 1;
        }
        return next;
      });
    }, 800);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [ROUTE_COORDS, selectionPhase]); // restarts on every coord change or phase transition

  // ── Camera follows dot ──────────────────────────────────────────────────────
  // Depends on dotIndex AND routeVersion so it fires immediately after reroute
  // even when dotIndex is reset to 0 (same value, different version).
  useEffect(() => {
    const coords = activeCoordsRef.current;
    if (!coords || coords.length === 0) return;
    const idx = Math.min(dotIndex, coords.length - 1);
    const [lat, lon] = coords[idx];
    mapRef.current?.animateToRegion(
      { latitude: lat, longitude: lon, latitudeDelta: 0.008, longitudeDelta: 0.008 },
      600,
    );
  }, [dotIndex, routeVersion]);

  // ── Police station fetch ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPoliceLoading(true);
      try {
        let lat, lon;
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            lat = loc.coords.latitude;
            lon = loc.coords.longitude;
          }
        } catch (_) {}
        if ((lat == null || lon == null) && ROUTE_COORDS?.length > 0) {
          [lat, lon] = ROUTE_COORDS[0];
        }
        if (lat == null || lon == null) return;
        const station = await getNearestPoliceStation(lat, lon);
        if (!cancelled && isMounted.current) setPoliceStation(station);
      } catch (_) {}
      finally { if (!cancelled && isMounted.current) setPoliceLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Dual-route selection sequence — runs once on mount ─────────────────────
  // Phase 1 (0–2.5s):  'comparing'  — both routes visible, overlay shows comparison
  // Phase 2 (2.5–4s):  'selecting'  — overlay says "Selecting safer route…"
  // Phase 3 (4s+):     'navigating' — secondary fades, dot animation starts
  useEffect(() => {
    if (!routes || routes.length < 2) {
      setSelectionPhase('navigating');
      return;
    }
    const t1 = setTimeout(() => setSelectionPhase('selecting'), 2500);
    const t2 = setTimeout(() => setSelectionPhase('navigating'), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // ── Zone alert / reroute modal timers ───────────────────────────────────────
  useEffect(() => {
    const t1 = setTimeout(() => setAlertVisible(true),   5000);
    const t2 = setTimeout(() => setRerouteVisible(true), 10000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // ── Floating contextual alerts ──────────────────────────────────────────────
  useEffect(() => {
    if (!selectedRoute) return;
    const { confidenceFactors = {}, safetyScore = 50, timeHour = 14 } = selectedRoute;
    const isNight    = timeHour >= 20 || timeHour < 6;
    const cautionPOI = confidenceFactors.cautionPOI ?? 0;
    const safePOI    = confidenceFactors.safePOI    ?? 0;
    const isolation  = confidenceFactors.isolation  ?? 0;
    const lighting   = confidenceFactors.lighting   ?? 0;

    const queue = [];
    if (cautionPOI >= 2 && isNight)
      queue.push({ text: '⚠ Nightlife-heavy area ahead', positive: false });
    else if (safetyScore < 45)
      queue.push({ text: '⚠ Lower-confidence stretch detected', positive: false });
    if (lighting < 35 && isNight)
      queue.push({ text: '⚠ Limited lighting and surveillance', positive: false });
    else if (safePOI >= 4)
      queue.push({ text: '✓ Active commercial activity nearby', positive: true });
    if (isolation >= 40)
      queue.push({ text: '⚠ Isolated stretch — stay alert', positive: false });
    else if (safetyScore >= 65)
      queue.push({ text: '✓ Well-monitored corridor ahead', positive: true });

    if (queue.length === 0) return;
    const timers = [];
    queue.slice(0, 2).forEach((alert, i) => {
      timers.push(setTimeout(() => {
        if (!isMounted.current) return;
        setFloatAlert(alert);
        setTimeout(() => { if (isMounted.current) setFloatAlert(null); }, 2800);
      }, i === 0 ? 7000 : 18000));
    });
    return () => timers.forEach(clearTimeout);
  }, [selectedRoute]);

  // ── Ahead-info strip — updates as dot progresses along route ────────────────
  // Looks ~15 steps ahead, derives a one-line contextual summary from the
  // route's scoring data. No extra API calls — uses already-computed factors.
  useEffect(() => {
    const coords = activeCoordsRef.current;
    if (!coords || coords.length === 0 || !selectedRoute) return;

    const { confidenceFactors = {}, confidenceTags = [], safetyScore = 50, timeHour = 14 } = selectedRoute;
    const isNight    = timeHour >= 20 || timeHour < 6;
    const cautionPOI = confidenceFactors.cautionPOI ?? 0;
    const safePOI    = confidenceFactors.safePOI    ?? 0;
    const isolation  = confidenceFactors.isolation  ?? 0;
    const lighting   = confidenceFactors.lighting   ?? 0;
    const emergency  = confidenceFactors.emergency  ?? 0;

    // Progress ratio: how far along the route is the dot
    const progress = dotIndex / Math.max(1, coords.length - 1);

    // Derive ahead message based on progress + route characteristics
    let info = null;

    if (progress < 0.25) {
      // Early in route — show overall corridor character
      if (safePOI >= 5)
        info = { icon: '🏪', text: 'Commercial corridor ahead — well-monitored', safe: true };
      else if (cautionPOI >= 2 && isNight)
        info = { icon: '⚠', text: 'Nightlife zone ahead — stay aware', safe: false };
      else if (safetyScore >= 65)
        info = { icon: '✓', text: 'Well-lit route ahead', safe: true };
      else
        info = { icon: '📍', text: 'Moderate confidence stretch ahead', safe: null };
    } else if (progress < 0.6) {
      // Mid-route
      if (isolation >= 40)
        info = { icon: '⚠', text: 'Isolated stretch ahead — limited foot traffic', safe: false };
      else if (emergency >= 50)
        info = { icon: '🚑', text: 'Emergency services accessible nearby', safe: true };
      else if (lighting < 35 && isNight)
        info = { icon: '🌑', text: 'Low lighting ahead — stay on main road', safe: false };
      else if (confidenceTags.includes('Active commercial zone'))
        info = { icon: '🏬', text: 'Active commercial zone — natural surveillance', safe: true };
      else
        info = { icon: '📍', text: `Safety confidence: ${safetyScore}/100`, safe: null };
    } else {
      // Approaching destination
      if (progress >= 0.85)
        info = { icon: '🚩', text: 'Approaching destination', safe: true };
      else if (cautionPOI >= 2 && isNight)
        info = { icon: '⚠', text: 'Caution zone near destination', safe: false };
      else
        info = { icon: '✓', text: 'Nearing destination — stay on route', safe: true };
    }

    setAheadInfo(info);
  }, [dotIndex, selectedRoute]);

  // ── Recenter ────────────────────────────────────────────────────────────────
  const handleRecenter = useCallback(() => {
    const coords = activeCoordsRef.current;
    if (!coords || coords.length === 0) return;
    mapRef.current?.animateToRegion(getRegionForCoords(coords), 500);
  }, []);

  // ── Adaptive rerouting ──────────────────────────────────────────────────────
  // Reads coords from activeCoordsRef — never stale regardless of closure age.
  const handleReroute = useCallback(async () => {
    if (rerouteInFlight.current) return;
    rerouteInFlight.current = true;
    if (isMounted.current) setIsRerouting(true);

    try {
      const activeCoords = activeCoordsRef.current;
      if (!activeCoords || activeCoords.length === 0) {
        if (isMounted.current) { setRerouteVisible(false); setIsRerouting(false); }
        rerouteInFlight.current = false;
        return;
      }

      // Read dotIndex from ref — no broken Promise/setState pattern
      const currentDotIndex = dotIndexRef.current;
      const currentPos = activeCoords[currentDotIndex] ?? activeCoords[0];

      if (!currentPos || !destCoords) {
        if (isMounted.current) { setRerouteVisible(false); setIsRerouting(false); }
        rerouteInFlight.current = false;
        return;
      }

      const newStart = { lat: currentPos[0], lon: currentPos[1] };

      const alternative = await getAlternativeRoute(
        newStart,
        destCoords,
        timeMode,
        travelMode,
        activeCoords,
      );

      if (!isMounted.current) { rerouteInFlight.current = false; return; }

      if (!alternative?.routeCoords?.length) {
        // No alternative found — dismiss modal silently
        if (isMounted.current) { setRerouteVisible(false); setIsRerouting(false); }
        rerouteInFlight.current = false;
        return;
      }

      const newCoords = alternative.routeCoords;

      // ── Atomic reroute commit ──────────────────────────────────────────────
      // 1. Update ref immediately — interval picks up new coords on next tick
      activeCoordsRef.current = newCoords;
      dotIndexRef.current = 0;

      // 2. Batch all state updates together
      setDotIndex(0);
      setRerouteCoords(newCoords);
      setRouteCoords(newCoords);
      // Bump version — forces Polyline/Marker key remount AND camera effect
      setRouteVersion(v => v + 1);

      // 3. Fit camera to full new route after render
      setTimeout(() => {
        if (!isMounted.current) return;
        mapRef.current?.animateToRegion(getRegionForCoords(newCoords), 700);
      }, 150);

    } catch (err) {
      // Log for debugging — never crash navigation
      console.warn('[Reroute] failed:', err?.message ?? err);
    } finally {
      rerouteInFlight.current = false;
      if (isMounted.current) { setIsRerouting(false); setRerouteVisible(false); }
    }
  }, [destCoords, timeMode, travelMode, setRouteCoords]);

  // ── Derived render values ───────────────────────────────────────────────────
  const routeLabel  = selectedRoute ? `${selectedRoute.emoji} ${selectedRoute.label}` : '✅ Route';
  const safetyScore = selectedRoute?.safetyScore ?? 50;

  const dotPosition = ROUTE_COORDS && ROUTE_COORDS[dotIndex]
    ? { latitude: ROUTE_COORDS[dotIndex][0], longitude: ROUTE_COORDS[dotIndex][1] }
    : null;
  const startCoord = ROUTE_COORDS?.length > 0
    ? { latitude: ROUTE_COORDS[0][0], longitude: ROUTE_COORDS[0][1] }
    : null;
  const endCoord = ROUTE_COORDS?.length > 1
    ? { latitude: ROUTE_COORDS[ROUTE_COORDS.length - 1][0], longitude: ROUTE_COORDS[ROUTE_COORDS.length - 1][1] }
    : null;

  // ── Arrival screen ──────────────────────────────────────────────────────────
  if (arrived) {
    const score = selectedRoute?.safetyScore ?? 50;
    const riskLvl = selectedRoute?.riskLevel ?? 'MODERATE';
    const scoreColor = getRiskColor(riskLvl);
    return (
      <View style={styles.arrivalContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F0FFF4" />

        {/* Success checkmark */}
        <View style={styles.arrivalCheckCircle}>
          <Text style={styles.arrivalCheckEmoji}>✓</Text>
        </View>

        <Text style={styles.arrivalTitle}>You've arrived safely.</Text>
        <Text style={styles.arrivalSub}>
          {destination ? `${destination.split(',')[0]}` : 'Destination reached'}
        </Text>

        {/* Trip summary card */}
        <View style={styles.arrivalCard}>
          <Text style={styles.arrivalCardLabel}>TRIP SUMMARY</Text>

          <View style={styles.arrivalRow}>
            <Text style={styles.arrivalRowIcon}>🛡</Text>
            <Text style={styles.arrivalRowText}>Safety Confidence</Text>
            <Text style={[styles.arrivalRowValue, { color: scoreColor }]}>{score}/100</Text>
          </View>

          <View style={[styles.arrivalRow, styles.arrivalRowBorder]}>
            <Text style={styles.arrivalRowIcon}>🕐</Text>
            <Text style={styles.arrivalRowText}>Duration</Text>
            <Text style={styles.arrivalRowValue}>{selectedRoute?.duration ?? '—'}</Text>
          </View>

          <View style={[styles.arrivalRow, styles.arrivalRowBorder]}>
            <Text style={styles.arrivalRowIcon}>📏</Text>
            <Text style={styles.arrivalRowText}>Distance</Text>
            <Text style={styles.arrivalRowValue}>{selectedRoute?.distance ?? '—'}</Text>
          </View>

          <View style={[styles.arrivalRow, styles.arrivalRowBorder]}>
            <Text style={styles.arrivalRowIcon}>✅</Text>
            <Text style={styles.arrivalRowText}>Route type</Text>
            <Text style={styles.arrivalRowValue}>{selectedRoute?.label ?? 'Route'}</Text>
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={styles.arrivalHomeBtn}
          onPress={() => navigation.navigate('Home')}
          activeOpacity={0.85}
        >
          <Text style={styles.arrivalHomeBtnText}>Back to Home →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.arrivalReportBtn}
          onPress={() => navigation.navigate('IncidentReport')}
          activeOpacity={0.8}
        >
          <Text style={styles.arrivalReportBtnText}>⚠ Report an incident on this route</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── No route guard ──────────────────────────────────────────────────────────
  if (!ROUTE_COORDS) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={[styles.safetyBar, { backgroundColor: colors.brand }]}>
          <View style={styles.safetyBarInner}>
            <Text style={styles.safetyBarText}>No route data available</Text>
          </View>
        </SafeAreaView>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, color: '#64748B' }}>Please select a route first.</Text>
          <TouchableOpacity
            style={{ marginTop: 16, padding: 14, backgroundColor: colors.brand, borderRadius: 12 }}
            onPress={() => navigation.goBack()}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Safety indicator bar */}
      <SafeAreaView style={[styles.safetyBar, { backgroundColor: zoneColor }]}>
        <View style={styles.safetyBarInner}>
          <View style={styles.pulsingDot}>
            <View style={[styles.pulsingDotCore, { backgroundColor: '#fff' }]} />
          </View>
          <Text style={styles.safetyBarText}>
            {currentZone.name}  ·  Confidence {currentZone.safetyScore}/100
          </Text>
          <Text style={styles.safetyBarRisk}>{currentZone.riskLevel}</Text>
        </View>
      </SafeAreaView>

      {/* ── Ahead-info strip — one line below safety bar ── */}
      {aheadInfo && (
        <View style={[
          styles.aheadStrip,
          aheadInfo.safe === true  ? styles.aheadStripSafe :
          aheadInfo.safe === false ? styles.aheadStripCaution :
          styles.aheadStripNeutral,
        ]}>
          <Text style={[
            styles.aheadStripText,
            aheadInfo.safe === true  ? styles.aheadStripTextSafe :
            aheadInfo.safe === false ? styles.aheadStripTextCaution :
            styles.aheadStripTextNeutral,
          ]}>
            {aheadInfo.icon}  {aheadInfo.text}
          </Text>
        </View>
      )}

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        mapType="standard"
      >
        {/* ── Primary (safest) route — thick green, active ── */}
        {polylineCoords.length > 0 && (
          <Polyline
            key={`polyline-${routeVersion}`}
            coordinates={polylineCoords}
            strokeColor={PRIMARY_ROUTE_COLOR}
            strokeWidth={8}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* ── Secondary (lower-confidence) route — ALWAYS visible, red/thinner ── */}
        {(() => {
          const sortedForMap = routes ? [...routes].sort((a, b) => b.safetyScore - a.safetyScore) : [];
          const secondaryRoute = sortedForMap.find(r => r.id !== selectedRoute?.id && r.routeCoords?.length > 1)
            ?? sortedForMap[1];
          if (!secondaryRoute) return null;
          const secCoords = secondaryRoute.routeCoords.map(([lat, lon]) => ({ latitude: lat, longitude: lon }));
          const isNavigating = selectionPhase === 'navigating';
          return (
            <Polyline
              key={`secondary-${routeVersion}`}
              coordinates={secCoords}
              strokeColor={isNavigating ? '#F87171' : SECONDARY_ROUTE_COLOR}
              strokeWidth={isNavigating ? 4 : 5}
              strokePattern={[12, 6]}
              lineCap="round"
              lineJoin="round"
            />
          );
        })()}

        {/* ── Primary route midpoint label marker ── */}
        {(() => {
          if (!ROUTE_COORDS || ROUTE_COORDS.length < 2) return null;
          const midIdx = Math.floor(ROUTE_COORDS.length * 0.35);
          const [lat, lon] = ROUTE_COORDS[midIdx];
          const tag = (selectedRoute?.confidenceTags ?? [])[0];
          return (
            <Marker
              key={`label-primary-${routeVersion}`}
              coordinate={{ latitude: lat, longitude: lon }}
              anchor={{ x: 0.5, y: 1.0 }}
              tracksViewChanges={false}
            >
              <View style={styles.routeLabelBubble}>
                <Text style={styles.routeLabelTitle}>✅ {selectedRoute?.duration ?? ''}</Text>
                <Text style={styles.routeLabelSub}>Confidence {selectedRoute?.safetyScore ?? '—'}</Text>
                {tag ? <Text style={styles.routeLabelTag} numberOfLines={1}>✦ {tag}</Text> : null}
              </View>
            </Marker>
          );
        })()}

        {/* ── Secondary route midpoint label marker ── */}
        {(() => {
          const sortedForLabel = routes ? [...routes].sort((a, b) => b.safetyScore - a.safetyScore) : [];
          const secRoute = sortedForLabel.find(r => r.id !== selectedRoute?.id && r.routeCoords?.length > 1)
            ?? sortedForLabel[1];
          if (!secRoute || !secRoute.routeCoords) return null;
          const midIdx = Math.floor(secRoute.routeCoords.length * 0.35);
          const [lat, lon] = secRoute.routeCoords[midIdx];
          // ETA difference
          const primaryMin = parseInt(selectedRoute?.duration) || 0;
          const secMin     = parseInt(secRoute.duration) || 0;
          const diff       = secMin - primaryMin;
          const diffStr    = diff > 0 ? `+${diff} min` : diff < 0 ? `${diff} min` : 'same';
          const tag = (secRoute.confidenceTags ?? [])[0];
          return (
            <Marker
              key={`label-secondary-${routeVersion}`}
              coordinate={{ latitude: lat, longitude: lon }}
              anchor={{ x: 0.5, y: 1.0 }}
              tracksViewChanges={false}
            >
              <View style={styles.routeLabelBubbleAlt}>
                <Text style={styles.routeLabelTitleAlt}>📍 {secRoute.duration ?? ''} · {diffStr}</Text>
                <Text style={styles.routeLabelSubAlt}>Confidence {secRoute.safetyScore ?? '—'}</Text>
                {tag ? <Text style={styles.routeLabelTagAlt} numberOfLines={1}>⚠ {tag}</Text> : null}
              </View>
            </Marker>
          );
        })()}

        {startCoord && (
          <Marker key={`start-${routeVersion}`} coordinate={startCoord} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.markerStart}>
              <Text style={styles.markerEmoji}>📍</Text>
            </View>
          </Marker>
        )}

        {endCoord && (
          <Marker key={`end-${routeVersion}`} coordinate={endCoord} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.markerEnd}>
              <Text style={styles.markerEmoji}>🚩</Text>
            </View>
          </Marker>
        )}

        {dotPosition && (
          <Marker key={`dot-${routeVersion}`} coordinate={dotPosition} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.animDot}>
              <View style={styles.animDotInner} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* ── Route selection overlay — only during comparing/selecting phases ── */}
      {selectionPhase !== 'navigating' && (() => {
        const sortedRoutes = routes ? [...routes].sort((a, b) => b.safetyScore - a.safetyScore) : [];
        const saferRoute  = sortedRoutes[0] ?? selectedRoute;
        const otherRoute  = sortedRoutes[1];
        const isSelecting = selectionPhase === 'selecting';
        const saferTags   = (saferRoute?.confidenceTags ?? []).slice(0, 2);
        const otherTags   = (otherRoute?.confidenceTags  ?? []).slice(0, 2);
        return (
          <View style={styles.selectionOverlay} pointerEvents="none">
            <View style={styles.selectionCard}>
              <View style={styles.selectionHeader}>
                <View style={styles.selectionDot} />
                <Text style={styles.selectionHeaderText}>
                  {isSelecting ? 'SELECTING SAFER ROUTE…' : 'ROUTE ANALYSIS'}
                </Text>
              </View>
              {isSelecting ? (
                <View style={styles.selectingRow}>
                  <ActivityIndicator size="small" color={colors.brand} />
                  <Text style={styles.selectingText}>Activating higher Safety Confidence route</Text>
                </View>
              ) : (
                <View style={styles.routeCompareRow}>
                  <View style={[styles.routeCompareCard, styles.routeCompareCardSafe]}>
                    <Text style={styles.routeCompareLabel}>✅ SAFER</Text>
                    <Text style={[styles.routeCompareScore, { color: getRiskColor(saferRoute?.riskLevel ?? 'LOW') }]}>
                      {saferRoute?.safetyScore ?? '—'}
                    </Text>
                    <Text style={styles.routeCompareSub}>{saferRoute?.duration ?? ''}</Text>
                    {saferTags.map((tag, i) => (
                      <View key={i} style={styles.routeCompareTag}>
                        <Text style={styles.routeCompareTagText} numberOfLines={1}>✦ {tag}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.routeCompareVs}>
                    <Text style={styles.routeCompareVsText}>VS</Text>
                  </View>
                  <View style={[styles.routeCompareCard, styles.routeCompareCardOther]}>
                    <Text style={styles.routeCompareLabelOther}>📍 ALT</Text>
                    <Text style={[styles.routeCompareScore, { color: getRiskColor(otherRoute?.riskLevel ?? 'MODERATE') }]}>
                      {otherRoute?.safetyScore ?? '—'}
                    </Text>
                    <Text style={styles.routeCompareSub}>{otherRoute?.duration ?? ''}</Text>
                    {otherTags.map((tag, i) => (
                      <View key={i} style={[styles.routeCompareTag, styles.routeCompareTagOther]}>
                        <Text style={[styles.routeCompareTagText, { color: '#92400E' }]} numberOfLines={1}>⚠ {tag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>
        );
      })()}

      {/* ── Persistent bottom comparison strip — always visible during navigation ── */}
      {selectionPhase === 'navigating' && (() => {
        const sortedBottom = routes ? [...routes].sort((a, b) => b.safetyScore - a.safetyScore) : [];
        const primary   = sortedBottom[0] ?? selectedRoute;
        const secondary = sortedBottom[1];
        if (!secondary) return null;
        const primaryMin  = parseInt(primary?.duration)   || 0;
        const secondaryMin = parseInt(secondary?.duration) || 0;
        const diff = secondaryMin - primaryMin;
        const diffStr = diff > 0 ? `+${diff} min` : diff < 0 ? `${diff} min` : 'same ETA';
        const secTag = (secondary.confidenceTags ?? [])[0];
        return (
          <View style={styles.bottomCompareStrip} pointerEvents="none">
            {/* Primary pill */}
            <View style={styles.bottomComparePrimary}>
              <Text style={styles.bottomComparePrimaryLabel}>✅ Recommended</Text>
              <Text style={styles.bottomComparePrimaryETA}>{primary?.duration ?? '—'}</Text>
              <Text style={styles.bottomComparePrimaryScore}>Confidence {primary?.safetyScore ?? '—'}</Text>
            </View>
            <View style={styles.bottomCompareDivider} />
            {/* Secondary pill */}
            <View style={styles.bottomCompareSecondary}>
              <Text style={styles.bottomCompareSecondaryLabel}>📍 Alternative</Text>
              <Text style={styles.bottomCompareSecondaryETA}>{secondary?.duration ?? '—'} · {diffStr}</Text>
              <Text style={styles.bottomCompareSecondaryScore}>Confidence {secondary?.safetyScore ?? '—'}</Text>
              {secTag ? <Text style={styles.bottomCompareSecondaryTag} numberOfLines={1}>⚠ {secTag}</Text> : null}
            </View>
          </View>
        );
      })()}

      {/* Floating SOS */}
      <SOSButton
        onLongPress={async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          navigation.navigate('SOS');
        }}
      />

      {/* Recenter */}
      <TouchableOpacity style={styles.recenterBtn} onPress={handleRecenter} activeOpacity={0.8}>
        <Text style={styles.recenterIcon}>⊕</Text>
      </TouchableOpacity>

      {/* Police */}
      <TouchableOpacity style={styles.policeBtn} onPress={() => setPoliceVisible(true)} activeOpacity={0.8}>
        <Text style={styles.policeBtnIcon}>🚔</Text>
      </TouchableOpacity>

      {/* Route info card */}
      <View style={styles.routeInfoCard}>
        <View style={styles.routeInfoRow}>
          <Text style={styles.routeInfoLabel}>{routeLabel}</Text>
          <View style={[styles.routeInfoBadge, { backgroundColor: zoneColor }]}>
            <Text style={styles.routeInfoBadgeText}>{safetyScore}</Text>
          </View>
        </View>
        {source && destination && (
          <Text style={styles.routeInfoSub} numberOfLines={1}>{source} → {destination}</Text>
        )}
        {selectedRoute && (
          <Text style={styles.routeInfoMeta}>{selectedRoute.duration}  ·  {selectedRoute.distance}</Text>
        )}
      </View>

      {/* Zone alert */}
      <Modal visible={alertVisible} transparent animationType="slide" onRequestClose={() => setAlertVisible(false)}>
        <View style={styles.alertBackdrop}>
          <View style={styles.alertBox}>
            <Text style={styles.alertIcon}>⚠️</Text>
            <Text style={styles.alertTitle}>Caution</Text>
            <Text style={styles.alertBody}>
              Entering low-visibility stretch.{'\n'}Stay aware of your surroundings.
            </Text>
            <TouchableOpacity style={styles.alertBtn} onPress={() => setAlertVisible(false)}>
              <Text style={styles.alertBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Shake-to-SOS */}
      <ShakeSOSAlert visible={shakeDetected} countdown={countdown} onCancel={cancelShakeSOS} />

      {/* Reroute modal */}
      <Modal visible={rerouteVisible} transparent animationType="slide" onRequestClose={() => setRerouteVisible(false)}>
        <View style={styles.alertBackdrop}>
          <View style={[styles.alertBox, styles.rerouteBox]}>
            <View style={styles.rerouteHeader}>
              <View style={styles.rerouteDot} />
              <Text style={styles.rerouteLabel}>ADAPTIVE SAFETY</Text>
            </View>
            <Text style={styles.rerouteTitle}>Safer route detected</Text>
            <Text style={styles.rerouteBody}>
              Low crowd density ahead on current path.{'\n'}A safer alternative has been identified.
            </Text>
            <View style={styles.rerouteBtnRow}>
              <TouchableOpacity
                style={styles.rerouteDismiss}
                onPress={() => setRerouteVisible(false)}
                activeOpacity={0.7}
                disabled={isRerouting}
              >
                <Text style={styles.rerouteDismissText}>Stay on route</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rerouteAccept, isRerouting && { opacity: 0.7 }]}
                onPress={handleReroute}
                activeOpacity={0.85}
                disabled={isRerouting}
              >
                {isRerouting
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Text style={styles.rerouteAcceptText}>Rerouting →</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Floating contextual alert */}
      {floatAlert && (
        <View
          pointerEvents="none"
          style={[styles.floatAlert, floatAlert.positive ? styles.floatAlertSafe : styles.floatAlertCaution]}
        >
          <Text style={[styles.floatAlertText, floatAlert.positive ? styles.floatAlertTextSafe : styles.floatAlertTextCaution]}>
            {floatAlert.text}
          </Text>
        </View>
      )}

      {/* Police modal */}
      <Modal visible={policeVisible} transparent animationType="slide" onRequestClose={() => setPoliceVisible(false)}>
        <View style={styles.alertBackdrop}>
          <View style={styles.policeModal}>
            <View style={styles.policeModalHeader}>
              <Text style={styles.policeModalTitle}>🚔 Nearest Police Support</Text>
              <TouchableOpacity onPress={() => setPoliceVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.policeModalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {policeLoading ? (
              <View style={styles.policeLoadingWrap}>
                <ActivityIndicator size="small" color={colors.brand} />
                <Text style={styles.policeLoadingText}>Finding nearest station…</Text>
              </View>
            ) : (
              [
                { icon: '🏢', label: 'Station',   value: policeStation?.name     ?? 'Nearest PCR Unit' },
                { icon: '📏', label: 'Distance',  value: policeStation?.distance ?? 'Calculating…'     },
                { icon: '🕐', label: 'ETA',       value: policeStation?.eta      ?? '~4 min'           },
                { icon: '📞', label: policeStation?.phone ? 'Phone' : 'Emergency',
                              value: policeStation?.phone ?? '112' },
              ].map((row, i) => (
                <View key={i} style={[styles.policeModalRow, i > 0 && styles.policeModalRowBorder]}>
                  <Text style={styles.policeModalIcon}>{row.icon}</Text>
                  <Text style={styles.policeModalLabel}>{row.label}</Text>
                  <Text style={styles.policeModalValue} numberOfLines={2}>{row.value}</Text>
                </View>
              ))
            )}
            <TouchableOpacity
              style={styles.policeCallBtn}
              onPress={() => { setPoliceVisible(false); call112(); }}
              activeOpacity={0.85}
            >
              <Text style={styles.policeCallBtnText}>📞 Call 112 — Emergency</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  safetyBar: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  safetyBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulsingDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  pulsingDotCore: { width: 6, height: 6, borderRadius: 3 },
  safetyBarText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  safetyBarRisk: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  map: { flex: 1 },

  /* ── Ahead-info strip ── */
  aheadStrip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
  },
  aheadStripSafe:    { backgroundColor: '#166534' },
  aheadStripCaution: { backgroundColor: '#7C2D12' },
  aheadStripNeutral: { backgroundColor: '#1E293B' },
  aheadStripText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  aheadStripTextSafe:    { color: '#BBF7D0' },
  aheadStripTextCaution: { color: '#FED7AA' },
  aheadStripTextNeutral: { color: '#94A3B8' },

  markerStart: {
    backgroundColor: '#EEF2FF',
    borderRadius: 20,
    padding: 4,
    borderWidth: 2,
    borderColor: '#6366F1',
  },
  markerEnd: {
    backgroundColor: '#FEE2E2',
    borderRadius: 20,
    padding: 4,
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  markerEmoji: { fontSize: 16 },

  animDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  animDotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#6366F1',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },

  routeInfoCard: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    right: 100,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  routeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  routeInfoLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  routeInfoBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  routeInfoBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  routeInfoSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  routeInfoMeta: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },

  recenterBtn: {
    position: 'absolute',
    bottom: 112,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  recenterIcon: { fontSize: 22, color: colors.brand },

  policeBtn: {
    position: 'absolute',
    bottom: 168,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  policeBtnIcon: { fontSize: 20 },

  policeModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  policeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  policeModalTitle:  { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  policeModalClose:  { fontSize: 18, color: colors.textSecondary },
  policeModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 12,
  },
  policeModalRowBorder: { borderTopWidth: 1, borderTopColor: colors.cardBorder },
  policeModalIcon:  { fontSize: 18, width: 24, textAlign: 'center' },
  policeModalLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', width: 64 },
  policeModalValue: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  policeCallBtn: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  policeCallBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  policeLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 20,
    justifyContent: 'center',
  },
  policeLoadingText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  floatAlert: {
    position: 'absolute',
    bottom: 130,
    left: 16,
    right: 100,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 5,
  },
  floatAlertSafe:    { backgroundColor: '#F0FFF4', borderWidth: 1, borderColor: '#BBF7D0' },
  floatAlertCaution: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA' },
  floatAlertText:    { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  floatAlertTextSafe:    { color: '#15803D' },
  floatAlertTextCaution: { color: '#92400E' },

  alertBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  alertBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  alertIcon:  { fontSize: 40, marginBottom: 8 },
  alertTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
  alertBody:  { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  alertBtn:   { backgroundColor: colors.brand, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 48 },
  alertBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  rerouteBox: {
    borderTopWidth: 3,
    borderTopColor: colors.brand,
  },
  rerouteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  rerouteDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.brand,
  },
  rerouteLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.brand,
    letterSpacing: 1,
  },
  rerouteTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  rerouteBody: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 21,
    marginBottom: 20,
  },
  rerouteBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rerouteDismiss: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    alignItems: 'center',
  },
  rerouteDismissText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  rerouteAccept: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: 'center',
  },
  rerouteAcceptText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ── Map route label bubbles ─────────────────────────────────────────────────
  routeLabelBubble: {
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: '#22C55E',
    minWidth: 110,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  routeLabelTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4ADE80',
  },
  routeLabelSub: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 1,
  },
  routeLabelTag: {
    fontSize: 9,
    color: '#4ADE80',
    fontWeight: '600',
    marginTop: 2,
  },
  routeLabelBubbleAlt: {
    backgroundColor: 'rgba(15,23,42,0.82)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#475569',
    minWidth: 110,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  routeLabelTitleAlt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  routeLabelSubAlt: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
  routeLabelTagAlt: {
    fontSize: 9,
    color: '#F59E0B',
    fontWeight: '600',
    marginTop: 2,
  },

  // ── Persistent bottom comparison strip ─────────────────────────────────────
  // Sits above the route info card, below the floating alerts, never covers SOS
  bottomCompareStrip: {
    position: 'absolute',
    bottom: 148,          // above routeInfoCard (32 + ~80 + 36 gap)
    left: 16,
    right: 100,           // avoids SOS button
    backgroundColor: 'rgba(15,23,42,0.90)',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  bottomComparePrimary: {
    flex: 1,
  },
  bottomComparePrimaryLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#4ADE80',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  bottomComparePrimaryETA: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 1,
  },
  bottomComparePrimaryScore: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
  bottomCompareDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 10,
  },
  bottomCompareSecondary: {
    flex: 1,
  },
  bottomCompareSecondaryLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  bottomCompareSecondaryETA: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 1,
  },
  bottomCompareSecondaryScore: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
  bottomCompareSecondaryTag: {
    fontSize: 9,
    color: '#F59E0B',
    fontWeight: '600',
    marginTop: 2,
  },

  // ── Route selection overlay ─────────────────────────────────────────────────
  selectionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    zIndex: 10,
  },
  selectionCard: {
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  selectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand,
  },
  selectionHeaderText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
  },

  // Selecting phase
  selectingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  selectingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },

  // Comparing phase — side by side cards
  routeCompareRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  routeCompareCard: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  routeCompareCardSafe: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  routeCompareCardOther: {
    backgroundColor: 'rgba(100,116,139,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(100,116,139,0.25)',
  },
  routeCompareLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#4ADE80',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  routeCompareLabelOther: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  routeCompareScore: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 32,
  },
  routeCompareSub: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
    marginBottom: 4,
  },
  routeCompareTag: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  routeCompareTagOther: {
    backgroundColor: 'rgba(251,191,36,0.12)',
  },
  routeCompareTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4ADE80',
  },
  routeCompareVs: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
  },
  routeCompareVsText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },

  // ── Arrival screen ──────────────────────────────────────────────────────────
  arrivalContainer: {
    flex: 1,
    backgroundColor: '#F0FFF4',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 32,
  },
  arrivalCheckCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  arrivalCheckEmoji: {
    fontSize: 48,
    color: '#FFFFFF',
    fontWeight: '300',
  },
  arrivalTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  arrivalSub: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 28,
    fontWeight: '500',
  },
  arrivalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 4,
  },
  arrivalCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 14,
  },
  arrivalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 12,
  },
  arrivalRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  arrivalRowIcon: { fontSize: 18, width: 26, textAlign: 'center' },
  arrivalRowText: {
    flex: 1,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  arrivalRowValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  arrivalHomeBtn: {
    width: '100%',
    backgroundColor: colors.brand,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  arrivalHomeBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  arrivalReportBtn: {
    paddingVertical: 10,
  },
  arrivalReportBtnText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '600',
    textAlign: 'center',
  },
});
