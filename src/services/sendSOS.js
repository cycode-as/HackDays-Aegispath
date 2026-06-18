/**
 * sendSOS.js — Complete SOS escalation service.
 *
 * Escalation order:
 *   1. SMS → all emergency contacts + 112
 *   2. Call → contact 1 → contact 2 → 112
 *
 * Message includes: name, GPS, Maps link, travel mode, cab details.
 * All operations are silent-fail — never crash during emergency.
 */

import * as SMS from 'expo-sms';
import { Linking } from 'react-native';
import * as Location from 'expo-location';

const memoryStore = new Map();
const fallbackStorage = {
  getItem: async (key) => memoryStore.get(key) ?? null,
  setItem: async (key, value) => { memoryStore.set(key, value); },
  removeItem: async (key) => { memoryStore.delete(key); },
};

let AsyncStorage = fallbackStorage;
try {
  const storageModule = require('@react-native-async-storage/async-storage');
  AsyncStorage = storageModule.default ?? storageModule;
} catch (_) {
  AsyncStorage = fallbackStorage;
}

// ─── Data loaders ─────────────────────────────────────────────────────────────

/** Load all emergency contacts. Returns [] on failure. */
export async function getEmergencyContacts() {
  try {
    const raw = await AsyncStorage.getItem('@aegispath_emergency_contacts');
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return [];
}

/** Load user profile. Returns { name, phone } or defaults. */
async function getUserProfile() {
  try {
    const raw = await AsyncStorage.getItem('@aegispath_user_profile');
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { name: 'User', phone: '' };
}

/** Load travel preference string. */
async function getTravelMode() {
  try {
    const mode = await AsyncStorage.getItem('@aegispath_travel_pref');
    if (mode) return mode.charAt(0).toUpperCase() + mode.slice(1);
  } catch (_) {}
  return 'Unknown';
}

/** Load cab details stored during CabVerificationScreen. */
async function getCabDetails() {
  try {
    const raw = await AsyncStorage.getItem('@aegispath_cab_details');
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

// ─── Location ─────────────────────────────────────────────────────────────────

/**
 * Fetch live GPS coordinates.
 * Returns { lat, lng, coordString, mapsLink } or null.
 */
export async function getLiveLocation() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const lat = loc.coords.latitude.toFixed(6);
    const lng = loc.coords.longitude.toFixed(6);
    return {
      lat,
      lng,
      coordString: `${lat}° N, ${lng}° E`,
      mapsLink: `https://maps.google.com/?q=${lat},${lng}`,
    };
  } catch (_) {
    return null;
  }
}

/** Get last known location as fallback. */
async function getLastKnownLocation() {
  try {
    const last = await Location.getLastKnownPositionAsync();
    if (!last) return null;
    const lat = last.coords.latitude.toFixed(6);
    const lng = last.coords.longitude.toFixed(6);
    return {
      lat,
      lng,
      coordString: `${lat}° N, ${lng}° E`,
      mapsLink: `https://maps.google.com/?q=${lat},${lng}`,
    };
  } catch (_) {
    return null;
  }
}

// ─── Dialer ───────────────────────────────────────────────────────────────────

/** Open native dialer. Silent-fail. */
export async function dialNumber(number) {
  if (!number) return;
  try {
    const url = `tel:${number}`;
    await Linking.openURL(url);
  } catch (_) {}
}

/** Call first emergency contact. */
export async function callFirstContact() {
  const contacts = await getEmergencyContacts();
  const first = contacts.find(c => c.phone);
  if (first) await dialNumber(first.phone);
}

/** Call 112 emergency services. */
export async function call112() {
  await dialNumber('112');
}

// ─── Message builder ──────────────────────────────────────────────────────────

/**
 * Build the complete emergency SMS message.
 * Includes GPS, Maps link, travel mode, and cab details if in cab mode.
 */
async function buildEmergencyMessage(locationData) {
  const profile   = await getUserProfile();
  const travelMode = await getTravelMode();
  const cabDetails = await getCabDetails();

  const coordString = locationData?.coordString ?? 'Location unavailable';
  const mapsLink    = locationData?.mapsLink    ?? 'https://maps.google.com/';

  let msg =
    `🚨 Emergency alert from ${profile.name}.\n` +
    `I may be in danger. Please help immediately.\n\n` +
    `📍 Current Location:\n${mapsLink}\n` +
    `Coordinates: ${coordString}\n\n` +
    `🚗 Travel Mode: ${travelMode}\n`;

  if (travelMode.toLowerCase() === 'cab' && cabDetails) {
    msg += `\n🚕 Cab Details:\n`;
    if (cabDetails.provider)      msg += `  Service: ${cabDetails.provider}\n`;
    if (cabDetails.driverName)    msg += `  Driver: ${cabDetails.driverName}\n`;
    if (cabDetails.vehicleNumber) msg += `  Vehicle: ${cabDetails.vehicleNumber}\n`;
    if (cabDetails.vehicleModel)  msg += `  Model: ${cabDetails.vehicleModel}\n`;
  }

  msg += `\n📡 Live tracking has been enabled.\n— Sent via AegisPath`;
  return msg;
}

// ─── SMS escalation ───────────────────────────────────────────────────────────

/**
 * Send emergency SMS to ALL contacts in a single SMS composer session.
 *
 * expo-sms cannot send silently — it opens the native SMS app.
 * We pass ALL contact numbers at once so the user only needs to press
 * Send ONE time to alert everyone simultaneously.
 *
 * The message includes GPS, Maps link, travel mode, and cab details.
 */
export async function sendSOS() {
  try {
    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) return;

    const contacts = await getEmergencyContacts();
    if (contacts.length === 0) {
      await SMS.sendSMSAsync([], 'I need help. Please track my location.');
      return;
    }

    // Gather location (fetched during the 3s countdown in SOSScreen)
    const loc = await getLiveLocation() ?? await getLastKnownLocation();
    const message  = await buildEmergencyMessage(loc);

    // Collect all valid phone numbers
    const phones = contacts
      .map(c => c.phone?.trim())
      .filter(Boolean);

    // Open SMS composer once with all recipients + pre-filled message
    // User presses Send once — all contacts receive the alert
    if (phones.length > 0) {
      await SMS.sendSMSAsync(phones, message);
    }

  } catch (_) {
    // Never throw — SOS must never crash
  }
}

// ─── Call escalation ──────────────────────────────────────────────────────────

/**
 * Sequential call escalation:
 *   1. Contact 1
 *   2. Contact 2 (after 8s delay — gives time for contact 1 to answer)
 *   3. 112 (after 16s delay)
 *
 * Returns cleanup function to cancel pending calls.
 */
export function startCallEscalation() {
  const timers = [];

  (async () => {
    const contacts = await getEmergencyContacts();
    const validContacts = contacts.filter(c => c.phone);

    // Call contact 1 immediately
    if (validContacts[0]) {
      await dialNumber(validContacts[0].phone);
    }

    // Call contact 2 after 8s
    if (validContacts[1]) {
      timers.push(setTimeout(() => dialNumber(validContacts[1].phone), 8000));
    }

    // Call 112 after 16s
    timers.push(setTimeout(() => dialNumber('112'), 16000));
  })();

  return () => timers.forEach(clearTimeout);
}
