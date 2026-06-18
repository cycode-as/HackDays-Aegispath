/**
 * ShakeSOSAlert — Shown when shake gesture is detected.
 * Calm, not panicky. User has 15 seconds to cancel.
 * "Emergency gesture detected. Activating SOS in 15 seconds."
 */

import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
} from 'react-native';
import { colors } from '../config/colors';

export default function ShakeSOSAlert({ visible, countdown, onCancel }) {
  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={s.backdrop}>
        <View style={s.card}>
          {/* Countdown circle */}
          <View style={s.countCircle}>
            <Text style={s.countText}>{countdown}</Text>
          </View>

          <Text style={s.title}>Emergency gesture detected</Text>
          <Text style={s.sub}>
            Activating SOS in {countdown} second{countdown !== 1 ? 's' : ''}.{'\n'}
            Tap cancel if this was accidental.
          </Text>

          <TouchableOpacity style={s.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
            <Text style={s.cancelText}>Cancel — I'm okay</Text>
          </TouchableOpacity>

          <Text style={s.note}>No alerts have been sent yet.</Text>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
  countCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.highRisk,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
    shadowColor: colors.highRisk,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  sub: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  cancelBtn: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginBottom: 14,
    width: '100%',
    alignItems: 'center',
  },
  cancelText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  note: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
