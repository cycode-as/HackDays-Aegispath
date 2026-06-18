import { create } from 'zustand';
import { getDynamicRoutes } from '../services/routingEngine';

export const useRouteStore = create((set, get) => ({
  routes:        [],
  selectedRoute: null,
  timeMode:      'night',
  travelMode:    'walking',
  isLoading:     false,
  error:         null,
  sosActive:     false,

  // Trip context — set from HomeScreen before navigating
  source:       '',
  destination:  '',
  sourceCoords: null, // { lat, lon }
  destCoords:   null, // { lat, lon }
  
  // User's live GPS location
  userLocation: null, // { lat, lon }
  setUserLocation: (loc) => set({ userLocation: loc }),

  // Dynamic route coordinates for NavigationScreen
  // Format: [[lat, lng], ...] — at least 2 points
  routeCoords: null,

  setTripContext: (source, destination, sourceCoords, destCoords) => 
    set({ source, destination, sourceCoords, destCoords }),
  setRouteCoords: (coords) => set({ routeCoords: coords }),
  setTravelMode: (mode) => set({ travelMode: mode }),

  fetchRoutes: async () => {
    const { sourceCoords, destCoords, timeMode, travelMode } = get();
    if (!sourceCoords || !destCoords) {
      set({ error: 'Please select both source and destination', isLoading: false });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const data = await getDynamicRoutes(sourceCoords, destCoords, timeMode, travelMode);
      set({ routes: data, isLoading: false });
      // Auto-select the highest Safety Confidence route
      get().selectSafestRoute();
    } catch (e) {
      set({ error: e.message, isLoading: false });
    }
  },

  setTimeMode: async (mode) => {
    set({ timeMode: mode, isLoading: true, error: null });
    const { sourceCoords, destCoords, travelMode } = get();
    if (!sourceCoords || !destCoords) {
      set({ isLoading: false });
      return;
    }
    try {
      const data = await getDynamicRoutes(sourceCoords, destCoords, mode, travelMode);
      set({ routes: data, isLoading: false });
      // Auto-select the highest Safety Confidence route after time mode change
      get().selectSafestRoute();
    } catch (e) {
      set({ error: e.message, isLoading: false });
    }
  },

  setSelectedRoute: (route) => set({
    selectedRoute: route,
    routeCoords: route?.routeCoords || null,
  }),

  // Always selects the highest Safety Confidence route from the current routes array.
  // Called automatically after fetchRoutes completes.
  selectSafestRoute: () => {
    const { routes } = get();
    if (!routes || routes.length === 0) return;
    const safest = [...routes].sort((a, b) => b.safetyScore - a.safetyScore)[0];
    set({ selectedRoute: safest, routeCoords: safest?.routeCoords || null });
  },
  setSosActive: (value) => set({ sosActive: value }),
}));