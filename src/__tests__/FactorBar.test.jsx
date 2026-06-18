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

// ---------------------------------------------------------------------------
// Property 1: FactorBar renders label and proportional fill for any valid input
// Validates: Requirements 2.1, 2.2
// ---------------------------------------------------------------------------
describe('Property 1: FactorBar renders label and proportional fill for any valid input', () => {
  it('renders the label text and animates fill to (value / 100) * trackWidth', () => {
    const TRACK_WIDTH = 300;
    // Spy on withTiming to capture the target value passed to the animation.
    const reanimated = require('react-native-reanimated');
    const withTimingSpy = jest.spyOn(reanimated, 'withTiming');

    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.integer({ min: 0, max: 100 }),
        (label, value) => {
          withTimingSpy.mockClear();

          const { getByText, getByTestId, unmount } = render(
            <FactorBar label={label} value={value} />
          );

          // 2.1 — label text is present
          expect(getByText(label)).toBeTruthy();

          // 2.2 — trigger onLayout with a fixed track width so the animation
          // target can be verified. act() flushes the state update and the
          // subsequent useEffect that calls withTiming.
          act(() => {
            fireEvent(getByTestId('factor-bar-track'), 'layout', {
              nativeEvent: { layout: { width: TRACK_WIDTH } },
            });
          });

          // The expected fill target is proportional to the track width.
          const expectedTarget = (value / 100) * TRACK_WIDTH;

          // Verify withTiming was called with the correct target width.
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
