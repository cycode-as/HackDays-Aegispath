import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, StatusBar, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../config/colors';

const MODES = [
  {
    id:       'walking',
    icon:     '🚶‍♀️',
    title:    'Walking',
    sub:      'Prioritises lighting, crowd density & isolated roads',
    tags:     ['Safer public roads', 'Crowd indicators', 'Quick SOS access'],
    color:    colors.safe,
  },
  {
    id:       'cab',
    icon:     '🚕',
    title:    'Cab / Auto',
    sub:      'Monitors route deviations & unexpected stops',
    tags:     ['Trip details stored', 'Route monitoring', 'Deviation alerts'],
    color:    colors.brand,
  },
];

export default function TravelModeScreen({ navigation }) {
  const [selected, setSelected] = useState(null);

  const handleContinue = () => {
    if (!selected) return;
    if (selected === 'cab') {
      navigation.navigate('CabVerification');
    } else {
      navigation.navigate('RouteComparison', { travelMode: selected });
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back */}
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>

        <Text style={s.title}>How are you{'\n'}travelling today?</Text>
        <Text style={s.sub}>
          This helps us calculate the right safety factors for your journey.
        </Text>

        {/* Mode cards — fixed height, no layout shift */}
        {MODES.map((mode) => {
          const active = selected === mode.id;
          return (
            <TouchableOpacity
              key={mode.id}
              style={[
                s.card,
                active && { borderColor: mode.color },
              ]}
              onPress={() => setSelected(mode.id)}
              activeOpacity={0.85}
            >
              {/* Radio */}
              <View style={[s.radio, active && { borderColor: mode.color }]}>
                {active && <View style={[s.radioDot, { backgroundColor: mode.color }]} />}
              </View>

              {/* Icon */}
              <View style={[s.iconBox, active && { backgroundColor: mode.color + '15' }]}>
                <Text style={s.iconText}>{mode.icon}</Text>
              </View>

              {/* Text */}
              <View style={s.cardText}>
                <Text style={[s.cardTitle, active && { color: mode.color }]}>
                  {mode.title}
                </Text>
                <Text style={s.cardSub}>{mode.sub}</Text>
                <View style={s.tagRow}>
                  {mode.tags.map((t, i) => (
                    <View key={i} style={[s.tag, { backgroundColor: mode.color + '15' }]}>
                      <Text style={[s.tagText, { color: mode.color }]}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Continue */}
        <TouchableOpacity
          style={[s.continueBtn, !selected && s.continueBtnOff]}
          onPress={handleContinue}
          disabled={!selected}
          activeOpacity={0.85}
        >
          <Text style={s.continueBtnText}>
            {selected === 'cab' ? 'Store Cab Details →' : 'Find Safe Route →'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.background },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 12 },

  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
    marginBottom: 24,
  },
  backIcon: { fontSize: 18, color: colors.textPrimary },

  title: {
    fontSize: 28, fontWeight: '900',
    color: colors.textPrimary,
    lineHeight: 34, marginBottom: 8,
  },
  sub: {
    fontSize: 14, color: colors.textSecondary,
    lineHeight: 20, marginBottom: 28,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
    // Fixed shadow — no layout shift
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: colors.cardBorder,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 3, flexShrink: 0,
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },

  iconBox: {
    width: 50, height: 50, borderRadius: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  iconText: { fontSize: 26 },

  cardText: { flex: 1, minWidth: 0 },
  cardTitle: {
    fontSize: 17, fontWeight: '800',
    color: colors.textPrimary, marginBottom: 4,
  },
  cardSub: {
    fontSize: 13, color: colors.textSecondary,
    lineHeight: 18, marginBottom: 10,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 11, fontWeight: '700' },

  continueBtn: {
    backgroundColor: colors.brand,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  continueBtnOff: { opacity: 0.4 },
  continueBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
