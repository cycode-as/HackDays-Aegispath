import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../config/colors';

const STORAGE_KEYS = {
  USER_PROFILE: '@aegispath_user_profile',
  EMERGENCY_CONTACTS: '@aegispath_emergency_contacts',
  TRAVEL_PREF: '@aegispath_travel_pref',
  TRUSTED_LOCATIONS: '@aegispath_trusted_locations',
  ONBOARDED: '@aegispath_onboarded',
};

const RELATION_CHIPS = ['Family', 'Friend', 'Partner', 'Colleague'];

const TRAVEL_OPTIONS = [
  {
    key: 'walking',
    icon: '🚶‍♀️',
    title: 'Walking',
    subtitle: 'Prioritises lighting & crowd safety',
  },
  {
    key: 'cab',
    icon: '🚕',
    title: 'Cab / Auto',
    subtitle: 'Monitors route deviations',
  },
  {
    key: 'transit',
    icon: '🚌',
    title: 'Public Transport',
    subtitle: 'Bus, metro & shared routes',
  },
  {
    key: 'mixed',
    icon: '🔀',
    title: 'Mixed',
    subtitle: 'I use different modes',
  },
];

const PERMISSION_ROWS = [
  {
    key: 'location',
    icon: '📍',
    title: 'Location Access',
    subtitle: 'Required for route safety analysis',
    defaultValue: true,
  },
  {
    key: 'call',
    icon: '📞',
    title: 'Call Permissions',
    subtitle: 'Used during SOS emergency calls',
    defaultValue: true,
  },
  {
    key: 'sms',
    icon: '💬',
    title: 'SMS Permissions',
    subtitle: 'Sends alerts to emergency contacts',
    defaultValue: true,
  },
  {
    key: 'notifications',
    icon: '🔔',
    title: 'Notifications',
    subtitle: 'Safety alerts and route warnings',
    defaultValue: true,
  },
  {
    key: 'shake',
    icon: '📳',
    title: 'Shake-to-SOS',
    subtitle: 'Shake phone to trigger emergency alert',
    defaultValue: false,
  },
];

const TRUSTED_LOCATION_SLOTS = [
  { key: 'home', icon: '🏠', label: 'Home' },
  { key: 'college', icon: '🏫', label: 'College' },
  { key: 'workplace', icon: '💼', label: 'Workplace' },
  { key: 'hostel', icon: '🏨', label: 'Hostel' },
];

const emptyContact = () => ({ name: '', phone: '', relation: '' });

export default function OnboardingScreen({ navigation }) {
  const [step, setStep] = useState(0);

  // Step 1 state
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [phoneError, setPhoneError] = useState(false);

  // Step 2 state
  const [contacts, setContacts] = useState([emptyContact()]);
  const [contactPhoneErrors, setContactPhoneErrors] = useState([false]);

  // Step 3 state
  const [travelPref, setTravelPref] = useState('');

  // Step 4 state
  const [trustedLocations, setTrustedLocations] = useState({
    home: '',
    college: '',
    workplace: '',
    hostel: '',
  });

  // Step 5 state
  const [permissions, setPermissions] = useState(
    PERMISSION_ROWS.reduce((acc, row) => {
      acc[row.key] = row.defaultValue;
      return acc;
    }, {})
  );

  useEffect(() => {
    // Routing decision is handled in App.js — no redirect needed here
  }, []);

  const handlePhoneChange = (text) => {
    const digits = text.replace(/\D/g, '').slice(0, 10);
    setUserPhone(digits);
    if (digits.length > 0 && digits.length < 10) {
      setPhoneError(true);
    } else {
      setPhoneError(false);
    }
  };

  const handleContactChange = (index, field, value) => {
    const updated = [...contacts];
    if (field === 'phone') {
      const digits = value.replace(/\D/g, '').slice(0, 10);
      updated[index] = { ...updated[index], phone: digits };
      const errors = [...contactPhoneErrors];
      errors[index] = digits.length > 0 && digits.length < 10;
      setContactPhoneErrors(errors);
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setContacts(updated);
  };

  const addContact = () => {
    if (contacts.length < 3) {
      setContacts([...contacts, emptyContact()]);
      setContactPhoneErrors([...contactPhoneErrors, false]);
    }
  };

  const removeContact = (index) => {
    const updated = contacts.filter((_, i) => i !== index);
    const errors = contactPhoneErrors.filter((_, i) => i !== index);
    setContacts(updated);
    setContactPhoneErrors(errors);
  };

  const handleFinish = async () => {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.USER_PROFILE,
        JSON.stringify({ name: userName, phone: userPhone, email: userEmail })
      );
      await AsyncStorage.setItem(
        STORAGE_KEYS.EMERGENCY_CONTACTS,
        JSON.stringify(contacts.filter((c) => c.name && c.phone.length === 10))
      );
      await AsyncStorage.setItem(STORAGE_KEYS.TRAVEL_PREF, travelPref);
      await AsyncStorage.setItem(
        STORAGE_KEYS.TRUSTED_LOCATIONS,
        JSON.stringify(trustedLocations)
      );
      await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDED, 'true');
      navigation.replace('Home');
    } catch (e) {
      console.error('Onboarding save error:', e);
    }
  };

  const goBack = () => {
    if (step > 1) setStep(step - 1);
    else setStep(0);
  };

  const goNext = () => setStep(step + 1);

  const step1Valid = userName.trim().length > 0 && userPhone.length === 10;
  const step2Valid = contacts.some(
    (c) => c.name.trim().length > 0 && c.phone.length === 10
  );
  const step3Valid = travelPref !== '';

  if (step === 0) {
    return <WelcomeStep onContinue={() => setStep(1)} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <StepHeader step={step} onBack={goBack} />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 && (
            <Step1
              userName={userName}
              setUserName={setUserName}
              userPhone={userPhone}
              handlePhoneChange={handlePhoneChange}
              phoneError={phoneError}
              userEmail={userEmail}
              setUserEmail={setUserEmail}
            />
          )}
          {step === 2 && (
            <Step2
              contacts={contacts}
              contactPhoneErrors={contactPhoneErrors}
              handleContactChange={handleContactChange}
              addContact={addContact}
              removeContact={removeContact}
            />
          )}
          {step === 3 && (
            <Step3 travelPref={travelPref} setTravelPref={setTravelPref} />
          )}
          {step === 4 && (
            <Step4
              trustedLocations={trustedLocations}
              setTrustedLocations={setTrustedLocations}
            />
          )}
          {step === 5 && (
            <Step5 permissions={permissions} setPermissions={setPermissions} />
          )}
          {step === 6 && <Step6 onFinish={handleFinish} />}
        </ScrollView>

        {step < 6 && (
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                getStepValid(step, step1Valid, step2Valid, step3Valid)
                  ? {}
                  : styles.primaryButtonDisabled,
              ]}
              onPress={goNext}
              disabled={!getStepValid(step, step1Valid, step2Valid, step3Valid)}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Continue →</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getStepValid(step, step1Valid, step2Valid, step3Valid) {
  if (step === 1) return step1Valid;
  if (step === 2) return step2Valid;
  if (step === 3) return step3Valid;
  return true;
}

// ─── Welcome Step ────────────────────────────────────────────────────────────

function WelcomeStep({ onContinue }) {
  return (
    <SafeAreaView style={styles.welcomeSafe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.welcomeContainer}>
        <View style={styles.welcomeTop}>
          <View style={styles.shieldBox}>
            <Text style={styles.shieldEmoji}>🛡</Text>
          </View>
          <Text style={styles.appName}>AegisPath</Text>
          <Text style={styles.welcomeHeadline}>
            {'Navigate smarter.\nTravel safer.'}
          </Text>
          <Text style={styles.welcomeSubtitle}>
            Your intelligent safety companion.
          </Text>
        </View>

        <View style={styles.welcomeButtons}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Create Account</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.outlineButton}
            onPress={onContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.outlineButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.legalText}>
          By continuing you agree to our Terms &amp; Privacy Policy.
        </Text>
      </View>
    </SafeAreaView>
  );
}

// ─── Step Header ─────────────────────────────────────────────────────────────

function StepHeader({ step, onBack }) {
  return (
    <View style={styles.stepHeader}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.7}
      >
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>
      <View style={styles.dotsRow}>
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <View
            key={s}
            style={[styles.dot, step === s ? styles.dotActive : styles.dotInactive]}
          />
        ))}
      </View>
      <View style={styles.backButtonPlaceholder} />
    </View>
  );
}

// ─── Step 1 — Your Details ────────────────────────────────────────────────────

function Step1({
  userName,
  setUserName,
  userPhone,
  handlePhoneChange,
  phoneError,
  userEmail,
  setUserEmail,
}) {
  return (
    <View>
      <Text style={styles.stepTitle}>Tell us about you</Text>
      <Text style={styles.stepSubtitle}>
        Used to personalise your safety profile
      </Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Full Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your full name"
          placeholderTextColor={colors.textSecondary}
          value={userName}
          onChangeText={setUserName}
          autoCapitalize="words"
          returnKeyType="next"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Phone Number</Text>
        <TextInput
          style={[
            styles.input,
            phoneError && styles.inputError,
          ]}
          placeholder="10-digit mobile number"
          placeholderTextColor={colors.textSecondary}
          value={userPhone}
          onChangeText={handlePhoneChange}
          keyboardType="number-pad"
          maxLength={10}
          returnKeyType="next"
        />
        {phoneError && (
          <Text style={styles.errorText}>
            Phone number must be exactly 10 digits
          </Text>
        )}
        {userPhone.length === 10 && !phoneError && (
          <Text style={styles.validText}>✓ Valid number</Text>
        )}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>
          Email{' '}
          <Text style={styles.optionalLabel}>(Optional)</Text>
        </Text>
        <TextInput
          style={styles.input}
          placeholder="your@email.com"
          placeholderTextColor={colors.textSecondary}
          value={userEmail}
          onChangeText={setUserEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          returnKeyType="done"
        />
      </View>
    </View>
  );
}

// ─── Step 2 — Emergency Contacts ─────────────────────────────────────────────

function Step2({ contacts, contactPhoneErrors, handleContactChange, addContact, removeContact }) {
  return (
    <View>
      <Text style={styles.stepTitle}>Emergency contacts</Text>
      <Text style={styles.stepSubtitle}>
        Alerted instantly when you trigger SOS
      </Text>

      <View style={styles.infoCard}>
        <Text style={styles.infoCardText}>
          These contacts are stored on your device and never shared without your
          consent.
        </Text>
      </View>

      {contacts.map((contact, index) => (
        <View key={index} style={styles.contactCard}>
          <View style={styles.contactCardHeader}>
            <Text style={styles.contactCardTitle}>Contact {index + 1}</Text>
            {contacts.length > 1 && (
              <TouchableOpacity
                onPress={() => removeContact(index)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Contact name"
              placeholderTextColor={colors.textSecondary}
              value={contact.name}
              onChangeText={(v) => handleContactChange(index, 'name', v)}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Phone</Text>
            <TextInput
              style={[
                styles.input,
                contactPhoneErrors[index] && styles.inputError,
              ]}
              placeholder="10-digit mobile number"
              placeholderTextColor={colors.textSecondary}
              value={contact.phone}
              onChangeText={(v) => handleContactChange(index, 'phone', v)}
              keyboardType="number-pad"
              maxLength={10}
            />
            {contactPhoneErrors[index] && (
              <Text style={styles.errorText}>
                Phone number must be exactly 10 digits
              </Text>
            )}
            {contact.phone.length === 10 && !contactPhoneErrors[index] && (
              <Text style={styles.validText}>✓ Valid number</Text>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Relationship</Text>
            <View style={styles.chipsRow}>
              {RELATION_CHIPS.map((chip) => (
                <TouchableOpacity
                  key={chip}
                  style={[
                    styles.chip,
                    contact.relation === chip && styles.chipActive,
                  ]}
                  onPress={() => handleContactChange(index, 'relation', chip)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.chipText,
                      contact.relation === chip && styles.chipTextActive,
                    ]}
                  >
                    {chip}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      ))}

      {contacts.length < 3 && (
        <TouchableOpacity
          style={styles.addContactButton}
          onPress={addContact}
          activeOpacity={0.8}
        >
          <Text style={styles.addContactText}>+ Add contact</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Step 3 — Travel Preference ───────────────────────────────────────────────

function Step3({ travelPref, setTravelPref }) {
  return (
    <View>
      <Text style={styles.stepTitle}>How do you usually travel?</Text>
      <Text style={styles.stepSubtitle}>
        Helps us personalise route risk analysis
      </Text>

      {TRAVEL_OPTIONS.map((option) => {
        const selected = travelPref === option.key;
        return (
          <TouchableOpacity
            key={option.key}
            style={[styles.travelCard, selected && styles.travelCardSelected]}
            onPress={() => setTravelPref(option.key)}
            activeOpacity={0.85}
          >
            <View style={styles.radioOuter}>
              {selected && <View style={styles.radioInner} />}
            </View>
            <Text style={styles.travelIcon}>{option.icon}</Text>
            <View style={styles.travelTextBlock}>
              <Text style={styles.travelTitle}>{option.title}</Text>
              <Text style={styles.travelSubtitle}>{option.subtitle}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Step 4 — Trusted Locations ───────────────────────────────────────────────

function Step4({ trustedLocations, setTrustedLocations }) {
  const update = (key, value) => {
    setTrustedLocations((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <View>
      <Text style={styles.stepTitle}>Your trusted locations</Text>
      <Text style={styles.stepSubtitle}>
        Optional — helps with quick navigation and emergency routing
      </Text>

      <View style={styles.card}>
        {TRUSTED_LOCATION_SLOTS.map((slot, index) => (
          <View
            key={slot.key}
            style={[
              styles.locationRow,
              index < TRUSTED_LOCATION_SLOTS.length - 1 && styles.locationRowBorder,
            ]}
          >
            <View style={styles.locationLabelBlock}>
              <Text style={styles.locationIcon}>{slot.icon}</Text>
              <Text style={styles.locationLabel}>{slot.label}</Text>
            </View>
            <TextInput
              style={styles.locationInput}
              placeholder="Add address"
              placeholderTextColor={colors.textSecondary}
              value={trustedLocations[slot.key]}
              onChangeText={(v) => update(slot.key, v)}
              returnKeyType="next"
            />
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Step 5 — Permissions ─────────────────────────────────────────────────────

function Step5({ permissions, setPermissions }) {
  const toggle = (key) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <View>
      <Text style={styles.stepTitle}>Safety setup</Text>
      <Text style={styles.stepSubtitle}>
        Enable these for the best protection
      </Text>

      <View style={styles.card}>
        {PERMISSION_ROWS.map((row, index) => (
          <View
            key={row.key}
            style={[
              styles.permissionRow,
              index < PERMISSION_ROWS.length - 1 && styles.permissionRowBorder,
            ]}
          >
            <View style={styles.permissionIconCircle}>
              <Text style={styles.permissionIcon}>{row.icon}</Text>
            </View>
            <View style={styles.permissionTextBlock}>
              <Text style={styles.permissionTitle}>{row.title}</Text>
              <Text style={styles.permissionSubtitle}>{row.subtitle}</Text>
            </View>
            <Switch
              value={permissions[row.key]}
              onValueChange={() => toggle(row.key)}
              trackColor={{ false: colors.cardBorder, true: colors.brand }}
              thumbColor={colors.surface}
              ios_backgroundColor={colors.cardBorder}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Step 6 — Confirmation ────────────────────────────────────────────────────

function Step6({ onFinish }) {
  return (
    <View style={styles.confirmContainer}>
      <View style={styles.checkCircle}>
        <Text style={styles.checkEmoji}>✓</Text>
      </View>

      <Text style={styles.confirmTitle}>
        {'Your safety profile\nis ready.'}
      </Text>

      <View style={styles.confirmRows}>
        {[
          'Safety contacts saved',
          'Travel preferences set',
          'Emergency system active',
        ].map((item) => (
          <View key={item} style={styles.confirmRow}>
            <Text style={styles.confirmCheck}>✓</Text>
            <Text style={styles.confirmRowText}>{item}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, { marginTop: 40 }]}
        onPress={onFinish}
        activeOpacity={0.85}
      >
        <Text style={styles.primaryButtonText}>Enter AegisPath →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Safe areas
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  welcomeSafe: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Welcome
  welcomeContainer: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 36,
  },
  welcomeTop: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  shieldBox: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  shieldEmoji: {
    fontSize: 40,
  },
  appName: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  welcomeHeadline: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 40,
    marginBottom: 14,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  welcomeButtons: {
    gap: 12,
    marginBottom: 20,
  },
  legalText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Step header
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: colors.background,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 18,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  backButtonPlaceholder: {
    width: 36,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: colors.brand,
  },
  dotInactive: {
    backgroundColor: colors.cardBorder,
  },

  // Scroll content
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },

  // Step titles
  stepTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6,
    marginTop: 4,
  },
  stepSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 24,
    lineHeight: 19,
  },

  // Fields
  fieldGroup: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 7,
  },
  optionalLabel: {
    fontWeight: '400',
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  inputError: {
    borderColor: colors.highRisk,
    backgroundColor: '#FFF5F5',
  },
  errorText: {
    fontSize: 12,
    color: colors.highRisk,
    marginTop: 5,
  },
  validText: {
    fontSize: 12,
    color: colors.safe,
    marginTop: 5,
    fontWeight: '600',
  },

  // Info card
  infoCard: {
    backgroundColor: colors.brandLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  infoCardText: {
    fontSize: 13,
    color: colors.brand,
    lineHeight: 19,
  },

  // Contact card
  contactCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  contactCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  contactCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  removeText: {
    fontSize: 13,
    color: colors.highRisk,
    fontWeight: '600',
  },

  // Chips
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandLight,
  },
  chipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.brand,
    fontWeight: '700',
  },

  // Add contact button
  addContactButton: {
    borderWidth: 1.5,
    borderColor: colors.brand,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  addContactText: {
    fontSize: 14,
    color: colors.brand,
    fontWeight: '700',
  },

  // Travel cards
  travelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  travelCardSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandLight,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand,
  },
  travelIcon: {
    fontSize: 26,
    marginRight: 14,
  },
  travelTextBlock: {
    flex: 1,
  },
  travelTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  travelSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },

  // Generic card
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  // Trusted locations
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  locationRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  locationLabelBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 100,
  },
  locationIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  locationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  locationInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: colors.textPrimary,
  },

  // Permissions
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  permissionRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  permissionIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  permissionIcon: {
    fontSize: 18,
  },
  permissionTextBlock: {
    flex: 1,
    marginRight: 10,
  },
  permissionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  permissionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },

  // Confirmation
  confirmContainer: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 16,
  },
  checkCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.safeLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: colors.safe,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  checkEmoji: {
    fontSize: 38,
    color: colors.safe,
    fontWeight: '900',
  },
  confirmTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 32,
  },
  confirmRows: {
    width: '100%',
    gap: 14,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  confirmCheck: {
    fontSize: 16,
    color: colors.safe,
    fontWeight: '900',
    marginRight: 12,
  },
  confirmRowText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  // Buttons
  primaryButton: {
    backgroundColor: colors.brand,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.surface,
    letterSpacing: 0.3,
  },
  outlineButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderWidth: 2,
    borderColor: colors.brand,
    backgroundColor: 'transparent',
  },
  outlineButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.brand,
    letterSpacing: 0.3,
  },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
});
