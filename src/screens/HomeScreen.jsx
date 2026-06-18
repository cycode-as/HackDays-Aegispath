import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { colors } from '../config/colors';
import { searchLocations, reverseGeocode } from '../services/locationSearch';
import { useRouteStore } from '../stores/useRouteStore';

const QUICK_CHIPS = [
  { key: 'home',      icon: '🏠', label: 'Home'    },
  { key: 'college',   icon: '🏫', label: 'College' },
  { key: 'workplace', icon: '💼', label: 'Work'    },
  { key: 'hostel',    icon: '🏨', label: 'Hostel'  },
];

export default function HomeScreen({ navigation }) {
  const [userName, setUserName]             = useState('');
  const [source, setSource]                 = useState('');
  const [destination, setDestination]       = useState('');
  const [sourceCoords, setSourceCoords]     = useState(null);
  const [destCoords, setDestCoords]         = useState(null);
  const [activeField, setActiveField]       = useState(null);
  const [suggestions, setSuggestions]       = useState([]);
  const [searching, setSearching]           = useState(false);
  const [savedLocations, setSavedLocations] = useState({});
  const [recentSearches, setRecentSearches] = useState([]);
  const [fetchingGPS, setFetchingGPS]       = useState(false);
  const searchTimer = useRef(null);

  const setTripContext = useRouteStore(s => s.setTripContext);
  const setUserLocation = useRouteStore(s => s.setUserLocation);

  useEffect(() => {
    AsyncStorage.getItem('@aegispath_user_profile').then(raw => {
      if (raw) {
        const p = JSON.parse(raw);
        if (p.name) setUserName(p.name.split(' ')[0]);
      }
    });
    AsyncStorage.getItem('@aegispath_trusted_locations').then(raw => {
      if (raw) setSavedLocations(JSON.parse(raw));
    });
    AsyncStorage.getItem('@aegispath_recent_searches').then(raw => {
      if (raw) setRecentSearches(JSON.parse(raw));
    });
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.multiRemove([
      '@aegispath_user_profile',
      '@aegispath_emergency_contacts',
      '@aegispath_travel_pref',
      '@aegispath_trusted_locations',
      '@aegispath_onboarded',
    ]);
    navigation.replace('Onboarding');
  };

  // ── Debounced search ──
  const handleTextChange = (text, field) => {
    if (field === 'source') {
      setSource(text);
      setSourceCoords(null);
    } else {
      setDestination(text);
      setDestCoords(null);
    }

    clearTimeout(searchTimer.current);
    if (text.length < 2) { setSuggestions([]); return; }

    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const results = await searchLocations(text);
      setSuggestions(results);
      setSearching(false);
    }, 400);
  };

  const selectSuggestion = async (item) => {
    const label = item.label;
    const coords = (item.lat && item.lon) ? { lat: item.lat, lon: item.lon } : null;

    if (activeField === 'source') {
      setSource(label);
      setSourceCoords(coords);
    } else {
      setDestination(label);
      setDestCoords(coords);
    }
    setSuggestions([]);
    setActiveField(null);

    // Save to recent searches
    const updated = [label, ...recentSearches.filter(r => r !== label)].slice(0, 5);
    setRecentSearches(updated);
    await AsyncStorage.setItem('@aegispath_recent_searches', JSON.stringify(updated));
  };

  // ── Current Location via GPS ──
  const handleCurrentLocation = async () => {
    setFetchingGPS(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is needed to use this feature.');
        setFetchingGPS(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: loc.coords.latitude, lon: loc.coords.longitude };
      
      // Store in global state
      setUserLocation(coords);

      // Reverse geocode for display
      const label = await reverseGeocode(coords.lat, coords.lon);

      if (activeField === 'source' || !activeField) {
        setSource(label);
        setSourceCoords(coords);
      } else {
        setDestination(label);
        setDestCoords(coords);
      }
      setSuggestions([]);
      setActiveField(null);
    } catch (e) {
      Alert.alert('Location Error', 'Could not fetch your location. Please try again.');
    }
    setFetchingGPS(false);
  };

  const applyQuickChip = (chipKey) => {
    const saved = savedLocations[chipKey];
    if (!saved) return;
    // savedLocations may store { label, lat, lon } or just a string
    if (typeof saved === 'object' && saved.lat) {
      if (activeField === 'source' || !activeField) {
        setSource(saved.label || saved.address || chipKey);
        setSourceCoords({ lat: saved.lat, lon: saved.lon });
      } else {
        setDestination(saved.label || saved.address || chipKey);
        setDestCoords({ lat: saved.lat, lon: saved.lon });
      }
    } else {
      // Legacy string address — no coords
      if (activeField === 'source') setSource(saved);
      else setDestination(saved);
    }
    setSuggestions([]);
  };

  const handleFindRoute = () => {
    if (!source.trim() || !destination.trim()) return;
    if (!sourceCoords || !destCoords) {
      Alert.alert(
        'Missing Coordinates',
        'Please select locations from the search suggestions to get accurate routing.'
      );
      return;
    }
    setTripContext(source.trim(), destination.trim(), sourceCoords, destCoords);
    navigation.navigate('TravelMode');
  };

  const showDropdown = activeField !== null && (suggestions.length > 0 || searching || recentSearches.length > 0);
  const canSearch = source.trim().length > 0 && destination.trim().length > 0 && sourceCoords && destCoords;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.logoRow}>
            <View style={s.logoBox}>
              <Text style={s.logoEmoji}>🛡</Text>
            </View>
            <View>
              <Text style={s.appName}>
                <Text style={{ color: colors.textPrimary }}>Aegis</Text>
                <Text style={{ color: colors.brand }}>Path</Text>
              </Text>
              <Text style={s.aiLabel}>AI</Text>
            </View>
          </View>
          <TouchableOpacity style={s.logoutBtn} activeOpacity={0.7} onPress={handleLogout}>
            <Text style={s.logoutIcon}>⎋</Text>
          </TouchableOpacity>
        </View>

        {/* ── Hero ── */}
        <View style={s.hero}>
          <Text style={s.helloText}>{userName ? `Hello, ${userName}` : 'Hello,'}</Text>
          <Text style={s.heroTitle}>
            <Text style={s.heroStay}>STAY </Text>
            <Text style={s.heroSafe}>SAFE</Text>
          </Text>
          <Text style={s.heroSub}>
            Navigate safer, not just faster — AI-powered safe route planning.
          </Text>
          <View style={s.aiBadge}>
            <Text style={s.aiBadgeText}>✦ AegisPath Safety Engine • Online</Text>
          </View>
          <TouchableOpacity
            style={s.reportRow}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('IncidentReport')}
          >
            <Text style={s.reportRowIcon}>⚠️</Text>
            <Text style={s.reportRowText}>Report an incident on this route</Text>
            <Text style={s.reportRowArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* ── Route form card ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>PLAN YOUR ROUTE</Text>

          {/* Source input */}
          <View style={[s.inputRow, activeField === 'source' && s.inputRowActive]}>
            <View style={s.inputIconWrap}>
              <Text style={s.inputIcon}>📍</Text>
            </View>
            <View style={s.inputTextWrap}>
              <Text style={s.inputLabel}>START</Text>
              <TextInput
                style={s.input}
                value={source}
                onChangeText={t => handleTextChange(t, 'source')}
                onFocus={() => setActiveField('source')}
                placeholder="Search start location"
                placeholderTextColor={colors.textSecondary}
                returnKeyType="next"
              />
            </View>
            {source.length > 0 && (
              <TouchableOpacity
                onPress={() => { setSource(''); setSourceCoords(null); setActiveField('source'); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={s.clearBtn}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Connector */}
          <View style={s.connector}>
            <View style={s.dot} /><View style={s.dot} /><View style={s.dot} />
          </View>

          {/* Destination input */}
          <View style={[s.inputRow, activeField === 'dest' && s.inputRowActive]}>
            <View style={[s.inputIconWrap, { backgroundColor: '#FEE2E2' }]}>
              <Text style={s.inputIcon}>🚩</Text>
            </View>
            <View style={s.inputTextWrap}>
              <Text style={s.inputLabel}>DESTINATION</Text>
              <TextInput
                style={s.input}
                value={destination}
                onChangeText={t => handleTextChange(t, 'dest')}
                onFocus={() => setActiveField('dest')}
                placeholder="Search destination"
                placeholderTextColor={colors.textSecondary}
                returnKeyType="done"
              />
            </View>
            {destination.length > 0 && (
              <TouchableOpacity
                onPress={() => { setDestination(''); setDestCoords(null); setActiveField('dest'); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={s.clearBtn}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Dropdown suggestions ── */}
          {showDropdown && (
            <View style={s.dropdown}>
              {searching && (
                <View style={s.dropdownLoading}>
                  <ActivityIndicator size="small" color={colors.brand} />
                  <Text style={s.dropdownLoadingText}>Searching…</Text>
                </View>
              )}

              {/* Recent searches */}
              {!searching && suggestions.length === 0 && recentSearches.length > 0 && (
                <>
                  <Text style={s.dropdownSection}>Recent</Text>
                  {recentSearches.map((r, i) => (
                    <TouchableOpacity
                      key={i}
                      style={s.dropdownItem}
                      onPress={() => selectSuggestion({ label: r })}
                      activeOpacity={0.7}
                    >
                      <Text style={s.dropdownItemIcon}>🕐</Text>
                      <Text style={s.dropdownItemText} numberOfLines={1}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {/* Nominatim results */}
              {suggestions.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.dropdownItem, i < suggestions.length - 1 && s.dropdownItemBorder]}
                  onPress={() => selectSuggestion(item)}
                  activeOpacity={0.7}
                >
                  <Text style={s.dropdownItemIcon}>📍</Text>
                  <Text style={s.dropdownItemText} numberOfLines={2}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Quick access chips ── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.chipsScroll}
            contentContainerStyle={s.chipsContent}
          >
            <TouchableOpacity
              style={[s.chip, s.chipGPS]}
              onPress={handleCurrentLocation}
              activeOpacity={0.7}
              disabled={fetchingGPS}
            >
              {fetchingGPS ? (
                <ActivityIndicator size={14} color={colors.brand} />
              ) : (
                <Text style={s.chipIcon}>📡</Text>
              )}
              <Text style={s.chipText}>{fetchingGPS ? 'Locating…' : 'My Location'}</Text>
            </TouchableOpacity>
            {QUICK_CHIPS.map(chip => {
              const addr = savedLocations[chip.key];
              if (!addr) return null;
              return (
                <TouchableOpacity
                  key={chip.key}
                  style={s.chip}
                  onPress={() => applyQuickChip(chip.key)}
                  activeOpacity={0.7}
                >
                  <Text style={s.chipIcon}>{chip.icon}</Text>
                  <Text style={s.chipText}>{chip.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[s.cta, !canSearch && s.ctaDisabled]}
            onPress={handleFindRoute}
            activeOpacity={0.85}
            disabled={!canSearch}
          >
            <Text style={s.ctaText}>Find Safe Route →</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.poweredBy}>Powered by AegisPath AI</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.background },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 28,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  logoEmoji: { fontSize: 22 },
  appName:   { fontSize: 18, fontWeight: '800' },
  aiLabel:   { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },
  logoutBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.cardBorder,
  },
  logoutIcon: { fontSize: 16, color: colors.textSecondary },

  hero: { marginBottom: 24 },
  helloText: { fontSize: 15, color: colors.textSecondary },
  heroTitle: { fontSize: 38, fontWeight: '900', lineHeight: 42, marginBottom: 8 },
  heroStay:  { color: colors.textPrimary, fontStyle: 'italic' },
  heroSafe:  { color: colors.brand, fontStyle: 'italic' },
  heroSub:   { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 12 },
  aiBadge: {
    alignSelf: 'flex-start', backgroundColor: '#E8EDFF',
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
  },
  aiBadgeText: { fontSize: 12, color: colors.brand, fontWeight: '600' },
  reportRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF7ED', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    marginTop: 12, borderWidth: 1, borderColor: '#FED7AA', gap: 8,
  },
  reportRowIcon:  { fontSize: 15 },
  reportRowText:  { flex: 1, fontSize: 13, fontWeight: '600', color: '#92400E' },
  reportRowArrow: { fontSize: 14, color: '#92400E', fontWeight: '700' },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 20,
    padding: 20, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  cardTitle: {
    fontSize: 11, fontWeight: '700', color: colors.textSecondary,
    letterSpacing: 1, marginBottom: 14,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 14,
    padding: 12, gap: 10,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  inputRowActive: { borderColor: colors.brand, backgroundColor: '#FAFBFF' },
  inputIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  inputIcon:    { fontSize: 16 },
  inputTextWrap: { flex: 1, minWidth: 0 },
  inputLabel: {
    fontSize: 10, fontWeight: '700', color: colors.textSecondary,
    letterSpacing: 0.5, marginBottom: 1,
  },
  input: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, padding: 0 },
  clearBtn: { fontSize: 14, color: colors.textSecondary, paddingHorizontal: 4 },

  connector: { paddingLeft: 30, paddingVertical: 5, gap: 3 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', marginBottom: 3 },

  /* Dropdown */
  dropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginTop: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  dropdownLoading: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, padding: 14,
  },
  dropdownLoadingText: { fontSize: 13, color: colors.textSecondary },
  dropdownSection: {
    fontSize: 10, fontWeight: '700', color: colors.textSecondary,
    letterSpacing: 0.5, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4,
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
  },
  dropdownItemBorder: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  dropdownItemIcon: { fontSize: 16, flexShrink: 0 },
  dropdownItemText: { flex: 1, fontSize: 14, color: colors.textPrimary, fontWeight: '500' },

  /* Quick chips */
  chipsScroll: { marginTop: 12, marginBottom: 14 },
  chipsContent: { gap: 8, paddingRight: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F0F4FF',
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: '#C7D2FE',
  },
  chipGPS: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  chipIcon: { fontSize: 14 },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.brand },

  cta: {
    backgroundColor: colors.brand, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: colors.brand, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  poweredBy:  { textAlign: 'center', fontSize: 12, color: colors.textSecondary },
});
