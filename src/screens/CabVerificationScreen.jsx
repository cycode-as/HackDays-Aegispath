/**
 * CabVerificationScreen — Store cab and driver details for safety tracking.
 * NOT driver verification. Details stored for emergency reference only.
 */

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, StatusBar, ScrollView, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../config/colors';

const CAB_PROVIDERS = ['Ola', 'Uber', 'Rapido', 'Auto', 'Other'];

export default function CabVerificationScreen({ navigation }) {
  const [driverName,    setDriverName]    = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [provider,      setProvider]      = useState('');
  const [notes,         setNotes]         = useState('');
  const [shareTrip,     setShareTrip]     = useState(true);
  const [deviationAlert, setDeviationAlert] = useState(true);

  const handleStartTrip = async () => {
    // Persist cab details for SOS emergency message
    await AsyncStorage.setItem('@aegispath_cab_details', JSON.stringify({
      driverName:    driverName.trim(),
      vehicleNumber: vehicleNumber.trim(),
      provider:      provider,
      vehicleModel:  notes.trim(), // notes field doubles as model/extra info
    }));
    navigation.navigate('RouteComparison', { travelMode: 'cab' });
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
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={s.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={s.headerText}>
            <Text style={s.title}>Store Cab Details</Text>
            <Text style={s.subtitle}>Saved for emergency reference only</Text>
          </View>
        </View>

        {/* Info */}
        <View style={s.infoCard}>
          <Text style={s.infoIcon}>🛡</Text>
          <Text style={s.infoText}>
            These details are stored on your device and shared with emergency contacts if you trigger SOS.
          </Text>
        </View>

        {/* Driver details */}
        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>Driver & Vehicle</Text>

          <Text style={s.fieldLabel}>Driver Name (optional)</Text>
          <TextInput
            style={s.input}
            value={driverName}
            onChangeText={setDriverName}
            placeholder="e.g. Rajesh Kumar"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={s.fieldLabel}>Vehicle Number</Text>
          <TextInput
            style={[s.input, s.plateInput]}
            value={vehicleNumber}
            onChangeText={v => setVehicleNumber(v.toUpperCase())}
            placeholder="e.g. DL 3C AB 1234"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="characters"
          />

          <Text style={s.fieldLabel}>Cab Provider</Text>
          <View style={s.chipRow}>
            {CAB_PROVIDERS.map(p => (
              <TouchableOpacity
                key={p}
                style={[s.chip, provider === p && s.chipActive]}
                onPress={() => setProvider(p)}
                activeOpacity={0.7}
              >
                <Text style={[s.chipText, provider === p && s.chipTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[s.fieldLabel, { marginTop: 14 }]}>Notes (optional)</Text>
          <TextInput
            style={[s.input, { height: 72, textAlignVertical: 'top' }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional details…"
            placeholderTextColor={colors.textSecondary}
            multiline
          />
        </View>

        {/* Safety settings */}
        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>Safety Settings</Text>

          <View style={s.toggleRow}>
            <View style={s.toggleText}>
              <Text style={s.toggleTitle}>Share trip with contact</Text>
              <Text style={s.toggleSub}>Live location sent to a trusted contact</Text>
            </View>
            <Switch
              value={shareTrip}
              onValueChange={setShareTrip}
              trackColor={{ false: colors.cardBorder, true: colors.brand + '80' }}
              thumbColor={shareTrip ? colors.brand : '#CBD5E1'}
            />
          </View>

          <View style={s.divider} />

          <View style={s.toggleRow}>
            <View style={s.toggleText}>
              <Text style={s.toggleTitle}>Route deviation alerts</Text>
              <Text style={s.toggleSub}>Alert if cab takes an unexpected route</Text>
            </View>
            <Switch
              value={deviationAlert}
              onValueChange={setDeviationAlert}
              trackColor={{ false: colors.cardBorder, true: colors.brand + '80' }}
              thumbColor={deviationAlert ? colors.brand : '#CBD5E1'}
            />
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity style={s.startBtn} onPress={handleStartTrip} activeOpacity={0.85}>
          <Text style={s.startBtnText}>Start Trip →</Text>
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

  infoCard: {
    flexDirection: 'row', backgroundColor: '#EEF2FF',
    borderRadius: 14, padding: 14, gap: 10,
    marginBottom: 16, alignItems: 'flex-start',
  },
  infoIcon: { fontSize: 18, marginTop: 1 },
  infoText: { flex: 1, fontSize: 13, color: '#4338CA', lineHeight: 19, fontWeight: '500' },

  sectionCard: {
    backgroundColor: colors.surface, borderRadius: 16,
    padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: colors.cardBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: colors.textSecondary,
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 14,
  },

  fieldLabel: {
    fontSize: 11, fontWeight: '700', color: colors.textSecondary,
    letterSpacing: 0.4, marginBottom: 6, textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#F8FAFC', borderRadius: 10,
    borderWidth: 1.5, borderColor: colors.cardBorder,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: colors.textPrimary, marginBottom: 14,
  },
  plateInput: { letterSpacing: 1, fontWeight: '600' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1.5,
    borderColor: colors.cardBorder, backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.brand, backgroundColor: '#EEF2FF' },
  chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: colors.brand, fontWeight: '700' },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, gap: 12,
  },
  toggleText: { flex: 1 },
  toggleTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  toggleSub:   { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.cardBorder },

  startBtn: {
    backgroundColor: colors.brand, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: colors.brand, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28, shadowRadius: 8, elevation: 4,
  },
  startBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
