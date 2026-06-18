/**
 * Manual mock for react-native-gesture-handler.
 * The package is a peer dependency of @gorhom/bottom-sheet but is not
 * installed as a direct dependency. This mock satisfies the import.
 */
const React = require('react');
const { View, ScrollView, FlatList, TouchableOpacity } = require('react-native');

const GestureHandlerRootView = ({ children, style }) =>
  React.createElement(View, { style }, children);

const PanGestureHandler = ({ children }) =>
  React.createElement(View, null, children);

const TapGestureHandler = ({ children }) =>
  React.createElement(View, null, children);

const gestureHandlerRootHOC = (Component) => Component;

const State = {
  UNDETERMINED: 0,
  FAILED: 1,
  BEGAN: 2,
  CANCELLED: 3,
  ACTIVE: 4,
  END: 5,
};

module.exports = {
  __esModule: true,
  GestureHandlerRootView,
  PanGestureHandler,
  TapGestureHandler,
  gestureHandlerRootHOC,
  State,
  ScrollView,
  FlatList,
  TouchableOpacity,
};
