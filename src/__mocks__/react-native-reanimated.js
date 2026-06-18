/**
 * Minimal manual mock for react-native-reanimated v4.
 * Avoids the react-native-worklets dependency that is not installed.
 */
const React = require('react');
const { View, Text, Image } = require('react-native');

const NOOP = () => {};
const ID = (t) => t;

const useSharedValue = (init) => {
  const ref = { value: init };
  return ref;
};

const useAnimatedStyle = (callback) => {
  // In tests, call the callback immediately and return the style object.
  try {
    return callback() || {};
  } catch {
    return {};
  }
};

const withTiming = (toValue, _config, _callback) => toValue;
const withSpring = (toValue) => toValue;
const withDelay = (_delay, animation) => animation;
const withRepeat = (_animation, _numberOfReps, _reverse, _callback) => 0;
const withSequence = (..._animations) => 0;
const cancelAnimation = NOOP;

const Easing = {
  linear: ID,
  ease: ID,
  quad: ID,
  cubic: ID,
  poly: () => ID,
  sin: ID,
  circle: ID,
  exp: ID,
  elastic: () => ID,
  back: () => ID,
  bounce: ID,
  bezier: () => ID,
  bezierFn: () => ID,
  steps: () => ID,
  in: (easing) => easing,
  out: (easing) => easing,
  inOut: (easing) => easing,
};

const Animated = {
  View,
  Text,
  Image,
  ScrollView: require('react-native').ScrollView,
  FlatList: require('react-native').FlatList,
  createAnimatedComponent: ID,
};

module.exports = {
  __esModule: true,
  default: Animated,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps: (cb) => { try { return cb(); } catch { return {}; } },
  useAnimatedRef: () => ({ current: null }),
  useAnimatedScrollHandler: () => NOOP,
  useDerivedValue: (cb) => { const ref = { value: undefined }; try { ref.value = cb(); } catch {} return ref; },
  useAnimatedGestureHandler: () => ({}),
  useAnimatedReaction: NOOP,
  withTiming,
  withSpring,
  withDelay,
  withRepeat,
  withSequence,
  cancelAnimation,
  Easing,
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  interpolate: NOOP,
  interpolateColor: NOOP,
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
  makeMutable: (init) => ({ value: init }),
  ...Animated,
};
