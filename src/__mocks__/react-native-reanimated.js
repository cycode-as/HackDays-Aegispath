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

const withTiming = (toValue) => toValue;
const withSpring = (toValue) => toValue;
const withDelay = (_delay, animation) => animation;
const withRepeat = ID;
const withSequence = () => 0;
const cancelAnimation = NOOP;

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
  withTiming,
  withSpring,
  withDelay,
  withRepeat,
  withSequence,
  cancelAnimation,
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  interpolate: NOOP,
  interpolateColor: NOOP,
  runOnJS: ID,
  runOnUI: ID,
  ...Animated,
};
