/**
 * Property-based tests for FactorBar component.
 *
 * Feature: aegispath-phase2-phase3
 */

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import * as fc from 'fast-check';
import FactorBar, { getFactorBarColor } from '../components/FactorBar';
import { colors } from '../config/colors';

// ---------------------------------------------------------------------------
// Property 2: FactorBar colour mapping is correct for all values
// Validates: Requirements 2.3
// ---------------------------------------------------------------------------
describe('Property 2: FactorBar colour mapping is correct for all values', () => {
  it('returns colors.safe for value < 35, colors.moderate for 35 ≤ value < 60, colors.highRisk for value >= 60', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (value) => {
        const result = getFactorBarColor(value);
        if (value < 35) {
          expect(result).toBe(colors.safe);
        } else if (value < 60) {
          expect(result).toBe(colors.moderate);
        } else {
          expect(result).toBe(colors.highRisk);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// FACTOR_META maps known labels to a displayLabel; unknown labels fall back
// to rendering the raw label string. Both paths must work correctly.
const FACTOR_META = {
  Crime: 'High Crime Zone',
  Time:  'Night-time Risk',
  Crowd: 'Low Crowd Density',
  Infra: 'Poor Lighting',
};

// Prototype / Object property names that fc.string() can generate and that
// break getByText() lookups in @testing-library — exclude them all.
const RESERVED_STRINGS = new Set([
  'constructor', 'prototype', '__proto__', 'hasOwnProperty',
  'toString', 'valueOf', 'toLocaleString', 'isPrototypeOf',
  'propertyIsEnumerable', '__defineGetter__', '__defineSetter__',
  '__lookupGetter__', '__lookupSetter__',
]);

// Safe arbitrary: alphanumeric + space, no reserved words, no empty after trim.
const safeLabel = fc
  .stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,28}[A-Za-z0-9]$/)
  .filter(s => !RESERVED_STRINGS.has(s) && s.trim().length > 0);

// ---------------------------------------------------------------------------
// Property 1: FactorBar renders label and proportional fill for any valid input
// Validates: Requirements 2.1, 2.2
// ---------------------------------------------------------------------------
describe('Property 1: FactorBar renders label and proportional fill for any valid input', () => {
  it('renders the display label text and animates fill to (value / 100) * trackWidth', () => {
    const TRACK_WIDTH = 300;
    const reanimated = require('react-native-reanimated');
    const withTimingSpy = jest.spyOn(reanimated, 'withTiming');

    fc.assert(
      fc.property(
        safeLabel,
        fc.integer({ min: 0, max: 100 }),
        (label, value) => {
          withTimingSpy.mockClear();

          const { getByText, getByTestId, unmount } = render(
            <FactorBar label={label} value={value} />
          );

          // 2.1 — The component renders through FACTOR_META: known labels get
          // a displayLabel, unknown labels fall back to the raw label string.
          const expectedText = FACTOR_META[label] ?? label;
          expect(getByText(expectedText)).toBeTruthy();

          // 2.2 — Trigger onLayout so the animation target can be verified.
          act(() => {
            fireEvent(getByTestId('factor-bar-track'), 'layout', {
              nativeEvent: { layout: { width: TRACK_WIDTH } },
            });
          });

          const expectedTarget = (value / 100) * TRACK_WIDTH;
          expect(withTimingSpy).toHaveBeenCalledWith(
            expectedTarget,
            expect.objectContaining({ duration: 600 })
          );

          unmount();
        }
      ),
      { numRuns: 100 }
    );

    withTimingSpy.mockRestore();
  });
});
