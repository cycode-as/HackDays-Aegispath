/**
 * Property tests for useRouteStore
 *
 * Property 7: setSosActive round-trip correctness
 * Validates: Requirements 11.4
 */

import * as fc from 'fast-check';
import { useRouteStore } from '../stores/useRouteStore';

describe('useRouteStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each run
    useRouteStore.setState({
      routes: [],
      selectedRoute: null,
      timeMode: 'night',
      isLoading: false,
      error: null,
      sosActive: false,
    });
  });

  /**
   * Property 7: setSosActive round-trip correctness
   * Validates: Requirements 11.4
   */
  it('Property 7: setSosActive round-trip — sosActive always equals the value passed to setSosActive', () => {
    fc.assert(
      fc.property(fc.boolean(), (value) => {
        // Reset sosActive before each run
        useRouteStore.setState({ sosActive: false });

        useRouteStore.getState().setSosActive(value);

        expect(useRouteStore.getState().sosActive).toBe(value);
      }),
      { numRuns: 100 }
    );
  });
});
