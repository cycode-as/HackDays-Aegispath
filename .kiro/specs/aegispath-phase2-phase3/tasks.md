# Implementation Plan: AegisPath Phase 2 & Phase 3

## Overview

Extend the existing AegisPath app with explainability (Phase 2) and SOS (Phase 3) features. All tasks follow the dependency order: standalone components first, store extensions next, then screens and integration wiring. No existing files are deleted or restructured — only extended.

## Tasks

- [x] 1. Create `FactorBar.jsx` — animated factor progress bar
  - Create `src/components/FactorBar.jsx`
  - Accept `label` (string) and `value` (integer 0–100) props
  - Use `useSharedValue` + `useAnimatedStyle` + `withTiming(targetWidth, { duration: 600 })` for fill animation
  - Measure track width via `onLayout` before triggering animation in `useEffect`
  - Implement `getFactorBarColor(value)` as a pure exported helper: `value < 35` → `colors.safe`, `value < 60` → `colors.moderate`, `value >= 60` → `colors.highRisk`
  - Layout: label text left, percentage text right, grey track below with `Animated.View` fill inside
  - No dependency on RouteStore — fully standalone
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 1.1 Write property test — FactorBar colour mapping (Property 2)
    - **Property 2: FactorBar colour mapping is correct for all values**
    - Use `fc.integer({ min: 0, max: 100 })` with 100 runs
    - Import and call `getFactorBarColor(value)` directly (pure function, no render needed)
    - Assert `colors.safe` when `value < 35`, `colors.moderate` when `35 ≤ value < 60`, `colors.highRisk` when `value >= 60`
    - **Validates: Requirements 2.3**

  - [x] 1.2 Write property test — FactorBar renders label for any valid input (Property 1)
    - **Property 1: FactorBar renders label and proportional fill for any valid input**
    - Use `fc.string({ minLength: 1 })` and `fc.integer({ min: 0, max: 100 })` with 100 runs
    - Render `<FactorBar label={label} value={value} />` and assert `getByText(label)` is truthy
    - Mock `onLayout` to provide a fixed `trackWidth` (e.g., 300) and verify the animated fill target equals `(value / 100) * 300`
    - **Validates: Requirements 2.1, 2.2**

- [x] 2. Create `sendSOS.js` — SMS emergency service
  - Create `src/services/sendSOS.js`
  - `import * as SMS from 'expo-sms'`
  - Export `async function sendSOS()`
  - Call `SMS.isAvailableAsync()`; if `true`, call `SMS.sendSMSAsync([], 'I need help. Please track my location.')`
  - Wrap entire body in `try/catch` — swallow all errors silently, never throw
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 3. Extend `useRouteStore.js` — add SOS state
  - Open `src/stores/useRouteStore.js`
  - Add `sosActive: false` to the initial state object (alongside existing `routes`, `selectedRoute`, etc.)
  - Add `setSosActive: (value) => set({ sosActive: value })` action
  - Do NOT modify any existing fields or actions
  - _Requirements: 11.4_

  - [x] 3.1 Write property test — setSosActive round-trip (Property 7)
    - **Property 7: setSosActive round-trip correctness**
    - Use `fc.boolean()` with 100 runs
    - Call `useRouteStore.getState().setSosActive(value)` then assert `useRouteStore.getState().sosActive === value`
    - Reset store state between runs
    - **Validates: Requirements 11.4**

- [x] 4. Update `DayNightToggle.jsx` — add Reanimated spring animation
  - Open `src/components/DayNightToggle.jsx`
  - Add `import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'`
  - Add `useSharedValue(0)` for `translateX`; initial value `0` for `'day'`, pill width for `'night'`
  - Add `useEffect([timeMode])` that drives `translateX.value = withSpring(target, { stiffness: 200, damping: 20 })`
  - Replace the static `active` style on the pill `View` with an absolutely-positioned `Animated.View` sliding indicator inside the container
  - Keep all existing `onToggle` prop behaviour, `timeMode` prop, and `StyleSheet` entries intact
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 5. Create `SOSButton.jsx` — floating emergency button
  - Create `src/components/SOSButton.jsx`
  - Accept `onLongPress` prop (callback function)
  - Render a `TouchableOpacity` with `delayLongPress={1000}`
  - Absolute position: `bottom: 32`, `right: 24`
  - Red circle: `backgroundColor: colors.highRisk`, `borderRadius: 999`, `width: 64`, `height: 64`
  - White "SOS" text: `color: '#FFFFFF'`, `fontWeight: '800'`, `fontSize: 16`
  - Add iOS shadow (`shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`) and `elevation: 8` for Android
  - No dependency on RouteStore — fully standalone
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 6. Create `SOSScreen.jsx` — full-screen SOS emergency view
  - Create `src/screens/SOSScreen.jsx`
  - Import `sendSOS` from `../services/sendSOS` and `useRouteStore` from `../stores/useRouteStore`
  - Local state: `const [done, setDone] = useState(false)`
  - Reanimated shared values: `scale` (initial `1`), `opacity` (initial `1`)
  - `useEffect` on mount:
    1. Call `sendSOS()` (fire-and-forget, no await blocking UI)
    2. Start pulse: `withRepeat(withSequence(withTiming(1.3, { duration: 600 }), withTiming(1.0, { duration: 600 })), -1)` on `scale`; mirror with opacity `1 → 0.4 → 1`
    3. `setTimeout(() => setDone(true), 1500)`
  - When `done === false`: full-screen red (`colors.highRisk`) background, `Animated.View` pulsing circle, "Sending Alert…" white text
  - When `done === true`: show ✓ checkmark (large white text), "Alert Sent" text, "I'm Safe Now" `TouchableOpacity`
  - "I'm Safe Now" handler: `setSosActive(false)` + `navigation.navigate('Home')`
  - Use `navigation.navigate('Home')` (not `goBack()`) to ensure correct stack landing
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 11.1, 11.2, 11.3_

- [x] 7. Update `App.js` — register SOSScreen in navigator
  - Open `App.js`
  - Add `import SOSScreen from './src/screens/SOSScreen'`
  - Add `<Stack.Screen name="SOS" component={SOSScreen} />` inside `Stack.Navigator`
  - Do NOT modify existing `Home` or `RouteComparison` screen registrations
  - _Requirements: 11.5_

- [x] 8. Checkpoint — verify standalone pieces before integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Update `RouteComparisonScreen.jsx` — wire BottomSheet, FactorBars, and SOSButton
  - Open `src/screens/RouteComparisonScreen.jsx`
  - Add imports: `GestureHandlerRootView` from `react-native-gesture-handler`; `BottomSheet`, `BottomSheetView` from `@gorhom/bottom-sheet`; `Animated`, `useSharedValue`, `useAnimatedStyle`, `withDelay`, `withTiming` from `react-native-reanimated`; `* as Haptics` from `expo-haptics`; `FactorBar` from `../components/FactorBar`; `SOSButton` from `../components/SOSButton`; `getRiskColor` from `../config/colors`
  - Wrap the entire return JSX root in `<GestureHandlerRootView style={{ flex: 1 }}>`
  - Add `const bottomSheetRef = useRef(null)` (import `useRef` from React)
  - Update `handleSeeWhy(route)`: call `setSelectedRoute(route)` (replacing the existing `console.log`) then `bottomSheetRef.current?.snapToIndex(0)`
  - Define `RouteDetailSheet` as a named function inside the file (reads `selectedRoute` from `useRouteStore`):
    - Early return `null` if `selectedRoute` is falsy
    - Render inside a `ScrollView`: route label (`emoji + ' ' + label.toUpperCase()`), `safetyScore` large text coloured by `getRiskColor(riskLevel)`, four stagger-wrapped `FactorBar` components, badge row with `ConfidencePill`, full narrative (no `numberOfLines` cap)
    - Stagger: each `FactorBar` wrapped in `Animated.View` with `useSharedValue(0)` opacity driven by `withDelay(index * 100, withTiming(1, { duration: 400 }))` in a `useEffect`
    - Factor order: `[{ label: 'Crime', key: 'crime' }, { label: 'Time', key: 'time' }, { label: 'Crowd', key: 'crowd' }, { label: 'Infra', key: 'infra' }]`
  - Add `<BottomSheet ref={bottomSheetRef} snapPoints={['55%', '88%']} index={-1} enablePanDownToClose handleComponent={() => <View style={styles.handle} />}>` after the `FlatList` / skeleton block, inside `GestureHandlerRootView` but outside `SafeAreaView`
  - Add `<BottomSheetView>` inside `BottomSheet` containing `<RouteDetailSheet />`
  - Add `<SOSButton onLongPress={async () => { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); navigation.navigate('SOS'); }} />`
  - Add `handle` style: `width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginTop: 8`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 8.5_

  - [x] 9.1 Write property test — RouteCard onSeeWhy passes exact route object (Property 3)
    - **Property 3: RouteCard onSeeWhy callback passes the exact route object**
    - Use `fc.record(arbitraryRoute())` with 100 runs
    - Render `<RouteCard route={route} onSeeWhy={onSeeWhy} onNavigate={() => {}} />`, `fireEvent.press(getByText('See Why →'))`
    - Assert `onSeeWhy` called with the exact same route reference (`toBe`)
    - **Validates: Requirements 4.3**

  - [x] 9.2 Write property test — handleSeeWhy stores route in RouteStore (Property 4)
    - **Property 4: handleSeeWhy stores the exact route in the RouteStore**
    - Use `fc.record(arbitraryRoute())` with 100 runs
    - Call `useRouteStore.getState().setSelectedRoute(route)` directly
    - Assert `useRouteStore.getState().selectedRoute` is strictly equal (`toBe`) to the passed route
    - **Validates: Requirements 4.1**

  - [x] 9.3 Write property test — RouteDetailSheet renders all route data fields (Property 5)
    - **Property 5: RouteDetailSheet renders all route data fields**
    - Use `fc.record(arbitraryRouteWithBadges())` with 100 runs
    - Set `useRouteStore.setState({ selectedRoute: route })`
    - Render `<RouteDetailSheet />`, assert label text, safetyScore, `badges.length` ConfidencePill instances (via `testID="confidence-pill"`), and full narrative present
    - **Validates: Requirements 5.1, 5.4, 5.5**

  - [x] 9.4 Write property test — RouteComparisonScreen renders correct RouteCard count (Property 6)
    - **Property 6: RouteComparisonScreen renders correct number of RouteCards when loaded**
    - Use `fc.array(arbitraryRoute(), { minLength: 0, maxLength: 10 })` with 100 runs
    - Set `useRouteStore.setState({ routes, isLoading: false })`
    - Render `<RouteComparisonScreen navigation={mockNav} />`, assert `getAllByTestId('route-card').length === routes.length` and zero `skeleton-card` elements
    - **Validates: Requirements 7.2**

- [x] 10. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Implementation order matters: tasks 1–3 are standalone and have no cross-dependencies; tasks 4–5 are also standalone; task 6 depends on tasks 2 and 3; task 7 depends on task 6; task 9 depends on tasks 1, 3, 4, and 5
- All code uses `colors.js` design tokens — no hardcoded colour values except white (`'#FFFFFF'`) and the handle grey (`'#CBD5E1'`)
- Light theme only throughout
- `react-native-gesture-handler` mock must be set up in the test environment for `RouteComparisonScreen` tests
- Property tests use `fast-check` (`fc`) with a minimum of 100 runs per property
- Each property test is tagged with its property number and the requirements clause it validates
