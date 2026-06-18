/**
 * Property-based tests for RouteCard component.
 *
 * Feature: aegispath-phase2-phase3
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import * as fc from 'fast-check';
import RouteCard from '../components/RouteCard';

// ---------------------------------------------------------------------------
// arbitraryRoute — generates a valid route object for property tests
// ---------------------------------------------------------------------------
function arbitraryRoute() {
  return fc.record({
    id: fc.string({ minLength: 1, maxLength: 10 }),
    label: fc.string({ minLength: 1, maxLength: 30 }),
    emoji: fc.constantFrom('✅', '⚡', '🛡️', '🚶'),
    duration: fc.string({ minLength: 1 }),
    distance: fc.string({ minLength: 1 }),
    isRecommended: fc.boolean(),
    safetyScore: fc.integer({ min: 0, max: 100 }),
    riskScore: fc.integer({ min: 0, max: 100 }),
    riskLevel: fc.constantFrom('LOW', 'MODERATE', 'HIGH'),
    narrative: fc.string({ minLength: 1 }),
    badges: fc.array(
      fc.record({
        icon: fc.string({ minLength: 1 }),
        label: fc.string({ minLength: 1 }),
        type: fc.constantFrom('safe', 'risk'),
      }),
      { minLength: 0, maxLength: 5 }
    ),
    factors: fc.record({
      crime: fc.integer({ min: 0, max: 100 }),
      time:  fc.integer({ min: 0, max: 100 }),
      crowd: fc.integer({ min: 0, max: 100 }),
      infra: fc.integer({ min: 0, max: 100 }),
    }),
    zone: fc.record({
      crimeLevel: fc.integer({ min: 0, max: 100 }),
      crowdLevel: fc.string({ minLength: 1 }),
      infraLevel: fc.string({ minLength: 1 }),
    }),
    timeHour: fc.integer({ min: 0, max: 23 }),
  });
}

// ---------------------------------------------------------------------------
// Property 3: RouteCard onSeeWhy callback passes the exact route object
// Validates: Requirements 4.3
// ---------------------------------------------------------------------------
describe('Property 3: RouteCard onSeeWhy callback passes the exact route object', () => {
  it('invokes onSeeWhy with the exact same route reference when "See Why →" is pressed', () => {
    fc.assert(
      fc.property(arbitraryRoute(), (route) => {
        const onSeeWhy = jest.fn();

        const { getByText, unmount } = render(
          <RouteCard
            route={route}
            onSeeWhy={onSeeWhy}
            onNavigate={() => {}}
          />
        );

        fireEvent.press(getByText('See Why →'));

        // Referential identity — must be the exact same object
        expect(onSeeWhy).toHaveBeenCalledTimes(1);
        expect(onSeeWhy).toHaveBeenCalledWith(route);
        expect(onSeeWhy.mock.calls[0][0]).toBe(route);

        unmount();
      }),
      { numRuns: 100 }
    );
  });
});
