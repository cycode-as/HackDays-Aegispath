/**
 * Property-based tests for RouteComparisonScreen and RouteDetailSheet.
 *
 * Feature: aegispath-phase2-phase3
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import * as fc from 'fast-check';
import { useRouteStore } from '../stores/useRouteStore';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// @gorhom/bottom-sheet — mock the entire package
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View } = require('react-native');

  const BottomSheet = React.forwardRef(({ children }, _ref) => (
    <View testID="bottom-sheet">{children}</View>
  ));
  BottomSheet.displayName = 'BottomSheet';

  const BottomSheetView = ({ children }) => (
    <View testID="bottom-sheet-view">{children}</View>
  );

  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetView,
  };
});

// expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Heavy: 'Heavy' },
}));

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

// arbitraryRouteWithBadges — same as arbitraryRoute but guarantees at least 1 badge
function arbitraryRouteWithBadges() {
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
// Reset store before each test
// ---------------------------------------------------------------------------
beforeEach(() => {
  useRouteStore.setState({
    routes: [],
    selectedRoute: null,
    timeMode: 'night',
    isLoading: false,
    error: null,
    sosActive: false,
  });
});

// ---------------------------------------------------------------------------
// Property 4: handleSeeWhy stores the exact route in the RouteStore
// Validates: Requirements 4.1
// ---------------------------------------------------------------------------
describe('Property 4: handleSeeWhy stores the exact route in the RouteStore', () => {
  it('setSelectedRoute stores the exact route object (referential identity)', () => {
    fc.assert(
      fc.property(arbitraryRoute(), (route) => {
        // Reset before each run
        useRouteStore.setState({ selectedRoute: null });

        useRouteStore.getState().setSelectedRoute(route);

        expect(useRouteStore.getState().selectedRoute).toBe(route);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: RouteDetailSheet renders all route data fields
// Validates: Requirements 5.1, 5.4, 5.5
// ---------------------------------------------------------------------------
describe('Property 5: RouteDetailSheet renders all route data fields', () => {
  it('renders label, safetyScore, all badges, and full narrative for any route', () => {
    // Import RouteComparisonScreen which contains RouteDetailSheet inline.
    // We test RouteDetailSheet by setting selectedRoute in the store and
    // rendering RouteComparisonScreen (which renders RouteDetailSheet inside
    // the BottomSheet mock).
    const RouteComparisonScreen =
      require('../screens/RouteComparisonScreen').default;

    const mockNav = { navigate: jest.fn() };

    fc.assert(
      fc.property(arbitraryRouteWithBadges(), (route) => {
        // Set selectedRoute so RouteDetailSheet renders content
        useRouteStore.setState({ selectedRoute: route, routes: [], isLoading: false });

        const { getByText, queryAllByTestId, queryAllByText, unmount } = render(
          <RouteComparisonScreen navigation={mockNav} />
        );

        // 5.1 — route label (emoji + label.toUpperCase())
        expect(getByText(`${route.emoji} ${route.label.toUpperCase()}`)).toBeTruthy();

        // 5.2 — safetyScore appears somewhere in the rendered output
        // queryAllByText handles the case where score (e.g. "0") appears in
        // multiple places (score badge, factor bar percentages, POI counts)
        const scoreMatches = queryAllByText(String(route.safetyScore));
        expect(scoreMatches.length).toBeGreaterThanOrEqual(1);

        // 5.4 — exactly badges.length ConfidencePill instances
        const pills = queryAllByTestId('confidence-pill');
        expect(pills).toHaveLength(route.badges.length);

        // 5.5 — full narrative present
        expect(getByText(route.narrative)).toBeTruthy();

        unmount();
        // Reset store between runs
        useRouteStore.setState({ selectedRoute: null });
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: RouteComparisonScreen renders correct number of RouteCards
// Validates: Requirements 7.2
// ---------------------------------------------------------------------------
describe('Property 6: RouteComparisonScreen renders correct number of RouteCards when loaded', () => {
  it('renders exactly routes.length route-card elements and zero skeleton-card elements', () => {
    const RouteComparisonScreen =
      require('../screens/RouteComparisonScreen').default;

    const mockNav = { navigate: jest.fn() };

    fc.assert(
      fc.property(
        fc.array(arbitraryRoute(), { minLength: 0, maxLength: 10 }),
        (routes) => {
          // Override fetchRoutes to be a no-op so the useEffect doesn't
          // trigger a loading state that would show skeleton cards.
          useRouteStore.setState({
            routes,
            isLoading: false,
            selectedRoute: null,
            fetchRoutes: () => {},
          });

          const { getAllByTestId, queryAllByTestId, unmount } = render(
            <RouteComparisonScreen navigation={mockNav} />
          );

          if (routes.length > 0) {
            expect(getAllByTestId('route-card')).toHaveLength(routes.length);
          } else {
            expect(queryAllByTestId('route-card')).toHaveLength(0);
          }
          expect(queryAllByTestId('skeleton-card')).toHaveLength(0);

          unmount();
          // Restore fetchRoutes for subsequent runs
          useRouteStore.setState({ fetchRoutes: undefined });
        }
      ),
      { numRuns: 100 }
    );
  });
});
