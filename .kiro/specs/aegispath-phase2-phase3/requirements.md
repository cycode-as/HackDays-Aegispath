# Requirements Document

## Introduction

AegisPath is a React Native Expo application that helps users choose the safest walking/travel route by scoring and explaining route safety. Phase 1 delivered the core route comparison flow: a HomeScreen with pre-filled inputs, a RouteComparisonScreen showing scored route cards with skeleton loading, a day/night time toggle, and a Zustand-backed data layer.

Phase 2 and Phase 3 extend the app with two major capabilities:

1. **Explainability (Phase 2)** — Users can tap "See Why →" on any route card to open a bottom sheet that breaks down the safety score into four factor bars (Crime, Time, Crowd, Infra), displays all confidence badges, and shows the full narrative. The day/night toggle gains a spring animation. All factor bars animate in with a staggered entrance.

2. **SOS System + Polish (Phase 3)** — A floating SOS button appears on the route comparison screen. A long press triggers haptic feedback and navigates to a dedicated SOS screen that plays a pulsing animation, transitions to a success checkmark after 1.5 seconds, sends a pre-filled SMS via expo-sms, and provides an "I'm Safe Now" reset that returns the user to Home.

All new code must extend existing files and follow the established folder structure, design tokens from `colors.js`, and light-theme-only styling.

---

## Glossary

- **App**: The AegisPath React Native Expo application.
- **RouteComparisonScreen**: The screen (`src/screens/RouteComparisonScreen.jsx`) that displays route cards, the day/night toggle, and hosts the bottom sheet and SOS button.
- **RouteCard**: The component (`src/components/RouteCard.jsx`) that renders a single enriched route with score, badges, narrative, and action buttons.
- **BottomSheet**: The `@gorhom/bottom-sheet` overlay component rendered inside RouteComparisonScreen that displays route explainability detail.
- **FactorBar**: A new horizontal animated progress bar component (`src/components/FactorBar.jsx`) that visualises a single safety factor value (0–100).
- **DayNightToggle**: The existing toggle component (`src/components/DayNightToggle.jsx`) that switches between day and night time modes.
- **SOSButton**: A new floating action button component (`src/components/SOSButton.jsx`) that triggers the SOS flow on long press.
- **SOSScreen**: A new full-screen emergency screen (`src/screens/SOSScreen.jsx`) that shows a pulsing animation, transitions to a checkmark, and provides a reset action.
- **RouteStore**: The Zustand store (`src/stores/useRouteStore.js`) that holds routes, selectedRoute, timeMode, isLoading, error, and (after Phase 3) sosActive state.
- **sendSOS**: An async service function (`src/services/sendSOS.js`) that uses expo-sms to send a pre-filled emergency SMS.
- **GestureHandlerRootView**: The root wrapper from `react-native-gesture-handler` required by `@gorhom/bottom-sheet`.
- **Reanimated**: The `react-native-reanimated` library (v4) used for all animations in this feature.
- **SnapPoint**: A percentage-based height position at which the BottomSheet rests (e.g., `'55%'`, `'88%'`).
- **Factor**: One of four numeric risk contributors stored in `route.factors`: `crime`, `time`, `crowd`, `infra` (each 0–100).
- **RiskLevel**: A string enum (`'LOW'`, `'MODERATE'`, `'HIGH'`) derived from the computed risk score.
- **SafetyScore**: An integer 0–100 representing how safe a route is (inverse of risk score).
- **Narrative**: A human-readable string describing route safety conditions, stored on the enriched route object.
- **Badge**: An object `{ icon, label, type }` where `type` is `'safe'` or `'risk'`, rendered by `ConfidencePill`.
- **ConfidencePill**: The existing badge component (`src/components/ConfidencePill.jsx`) that renders a coloured pill for a single badge.
- **StaggeredAnimation**: An entrance animation sequence where each FactorBar fades in and expands its fill width with a delay of `index × 100ms`.
- **HapticFeedback**: A tactile vibration triggered via `expo-haptics` `ImpactFeedbackStyle.Heavy`.
- **SMS**: A text message sent via `expo-sms` containing the pre-filled emergency message.

---

## Requirements

### Requirement 1: Day/Night Toggle Spring Animation

**User Story:** As a user, I want the day/night toggle indicator to animate smoothly when I switch modes, so that the UI feels responsive and polished.

#### Acceptance Criteria

1. WHEN the user taps the Day or Night pill in the DayNightToggle, THE DayNightToggle SHALL animate the active indicator's transition using `withSpring` from Reanimated.
2. THE DayNightToggle SHALL preserve all existing toggle behaviour (calling `onToggle`, updating the RouteStore `timeMode`, triggering a route re-fetch) after the animation is added.
3. WHILE the spring animation is in progress, THE DayNightToggle SHALL remain interactive and accept further taps.

---

### Requirement 2: FactorBar Component

**User Story:** As a user, I want to see each safety factor visualised as a labelled progress bar, so that I can understand which specific factors make a route safer or riskier.

#### Acceptance Criteria

1. THE FactorBar SHALL accept a `label` prop (string) and a `value` prop (integer 0–100).
2. WHEN rendered, THE FactorBar SHALL display the label text and a horizontal progress bar whose filled width corresponds proportionally to `value` out of 100.
3. THE FactorBar SHALL colour the filled portion using design tokens from `colors.js` (safe colour for low values, risk colour for high values).
4. WHEN the FactorBar mounts, THE FactorBar SHALL animate the filled width from 0 to the target `value` width using Reanimated `withTiming`.
5. THE FactorBar SHALL be usable as a standalone component with no dependency on the RouteStore.

---

### Requirement 3: Bottom Sheet Integration in RouteComparisonScreen

**User Story:** As a user, I want a bottom sheet to slide up from the route comparison screen, so that I can view detailed safety information without leaving the screen.

#### Acceptance Criteria

1. THE RouteComparisonScreen SHALL wrap its root view in `GestureHandlerRootView` to satisfy the `@gorhom/bottom-sheet` gesture dependency.
2. THE RouteComparisonScreen SHALL render a `BottomSheet` component with snapPoints `['55%', '88%']`.
3. WHEN the RouteComparisonScreen first renders, THE BottomSheet SHALL be hidden (initial index `-1`).
4. THE BottomSheet SHALL display a visible drag handle to indicate it is draggable.
5. WHEN the user drags the BottomSheet below its lowest snap point, THE BottomSheet SHALL dismiss (return to index `-1`).

---

### Requirement 4: "See Why →" Button Connects to Bottom Sheet

**User Story:** As a user, I want to tap "See Why →" on a route card and have the bottom sheet open with that route's details, so that I can explore the safety breakdown for any route.

#### Acceptance Criteria

1. WHEN the user taps "See Why →" on a RouteCard, THE RouteComparisonScreen SHALL call `setSelectedRoute(route)` on the RouteStore with the tapped route object.
2. WHEN the user taps "See Why →" on a RouteCard, THE BottomSheet SHALL snap to its first snap point (`'55%'`).
3. THE RouteCard SHALL invoke the `onSeeWhy` callback prop with the route object when "See Why →" is pressed (existing behaviour — no change to RouteCard internals required beyond confirming the callback is wired).

---

### Requirement 5: Bottom Sheet Content — Route Explainability Detail

**User Story:** As a user, I want the bottom sheet to show the route label, safety score, factor breakdown, badges, and full narrative, so that I fully understand why a route received its score.

#### Acceptance Criteria

1. WHEN the BottomSheet is open and `selectedRoute` is set in the RouteStore, THE BottomSheet content SHALL display the route label (e.g., "✅ SAFEST") at the top.
2. WHEN the BottomSheet is open, THE BottomSheet content SHALL display the `safetyScore` as a large number coloured by `getRiskColor(riskLevel)`.
3. WHEN the BottomSheet is open, THE BottomSheet content SHALL render four FactorBars in order: Crime, Time, Crowd, Infra, using the corresponding values from `selectedRoute.factors`.
4. WHEN the BottomSheet is open, THE BottomSheet content SHALL render all badges from `selectedRoute.badges` using the existing `ConfidencePill` component.
5. WHEN the BottomSheet is open, THE BottomSheet content SHALL display the full `selectedRoute.narrative` text without truncation.
6. IF `selectedRoute` is null when the BottomSheet attempts to render content, THEN THE BottomSheet content SHALL render nothing (empty state) to avoid a null-reference error.

---

### Requirement 6: Staggered Entrance Animation for FactorBars

**User Story:** As a user, I want the factor bars to animate in one after another when the bottom sheet opens, so that the detail reveal feels dynamic and intentional.

#### Acceptance Criteria

1. WHEN the BottomSheet opens and renders the four FactorBars, THE BottomSheet content SHALL animate each FactorBar with a fade-in and width-expansion entrance.
2. THE BottomSheet content SHALL apply a stagger delay of `index × 100ms` to each FactorBar's entrance animation, where `index` is the zero-based position of the bar (Crime = 0, Time = 1, Crowd = 2, Infra = 3).
3. THE BottomSheet content SHALL implement the staggered animation using Reanimated `withDelay`, `withTiming`, `useSharedValue`, and `useAnimatedStyle`.
4. WHEN the BottomSheet is dismissed and reopened, THE FactorBar entrance animations SHALL replay from the beginning.

---

### Requirement 7: Skeleton Loading Flow Confirmation

**User Story:** As a user, I want to see skeleton cards while routes are loading after I tap "Find Safe Route", so that the app feels responsive and I know content is on its way.

#### Acceptance Criteria

1. WHEN the user taps "Find Safe Route" on HomeScreen and navigates to RouteComparisonScreen, THE RouteComparisonScreen SHALL display two `SkeletonCard` components while `isLoading` is `true` in the RouteStore.
2. WHEN `isLoading` transitions to `false`, THE RouteComparisonScreen SHALL replace the skeleton cards with the populated `RouteCard` list.
3. THE skeleton loading phase SHALL last approximately 1.2 seconds, matching the existing `mockAPI` delay, without requiring any additional artificial delay.

---

### Requirement 8: SOSButton Component

**User Story:** As a user, I want a clearly visible SOS button on the route comparison screen that I can long-press to trigger an emergency alert, so that I can quickly call for help if I feel unsafe.

#### Acceptance Criteria

1. THE SOSButton SHALL be positioned as a floating element in the bottom-right corner of its parent screen using absolute positioning.
2. THE SOSButton SHALL be visually styled in red (`colors.highRisk`) to communicate urgency.
3. WHEN the user long-presses the SOSButton for 1000ms, THE SOSButton SHALL invoke the `onLongPress` callback prop.
4. THE SOSButton SHALL accept an `onLongPress` prop (callback function).
5. THE RouteComparisonScreen SHALL render the SOSButton and, on `onLongPress`, trigger `expo-haptics` `ImpactFeedbackStyle.Heavy` and then navigate to the SOSScreen.

---

### Requirement 9: SOSScreen — Pulsing Animation and Checkmark Transition

**User Story:** As a user, I want the SOS screen to show a pulsing animation that transitions to a checkmark, so that I receive clear visual confirmation that my alert is being processed.

#### Acceptance Criteria

1. WHEN the SOSScreen mounts, THE SOSScreen SHALL display a full-screen red/emergency-themed UI with a pulsing circle animation.
2. THE SOSScreen SHALL implement the pulse using a looping Reanimated animation that alternates the circle's scale and opacity.
3. WHEN 1500ms have elapsed after the SOSScreen mounts, THE SOSScreen SHALL replace the pulsing circle with a success checkmark (✓).
4. THE SOSScreen SHALL use a clean, minimal layout with no extraneous UI elements during the animation phase.
5. THE SOSScreen SHALL call `sendSOS()` from the sendSOS service when it mounts, initiating the SMS send.

---

### Requirement 10: sendSOS Service

**User Story:** As a user, I want an SMS to be sent automatically when I trigger SOS, so that my emergency contact receives my alert without me having to type anything.

#### Acceptance Criteria

1. THE sendSOS service SHALL export an async function `sendSOS()`.
2. WHEN `sendSOS()` is called, THE sendSOS service SHALL check SMS availability using `SMS.isAvailableAsync()` from `expo-sms`.
3. WHEN SMS is available, THE sendSOS service SHALL open the SMS composer pre-filled with the message `"I need help. Please track my location."`.
4. IF SMS is not available on the device, THEN THE sendSOS service SHALL resolve without throwing an error (graceful no-op).

---

### Requirement 11: "I'm Safe Now" Reset Flow

**User Story:** As a user, I want an "I'm Safe Now" button on the SOS screen so that I can cancel the alert and return to the home screen once I feel safe.

#### Acceptance Criteria

1. WHEN the checkmark phase is displayed on SOSScreen, THE SOSScreen SHALL show an "I'm Safe Now" button.
2. WHEN the user taps "I'm Safe Now", THE SOSScreen SHALL call `setSosActive(false)` on the RouteStore.
3. WHEN the user taps "I'm Safe Now", THE SOSScreen SHALL navigate to the Home screen.
4. THE RouteStore SHALL expose a `sosActive` boolean (default `false`) and a `setSosActive(value)` action.
5. THE App navigator SHALL include SOSScreen as a registered screen so that `navigation.navigate('SOS')` resolves correctly.
