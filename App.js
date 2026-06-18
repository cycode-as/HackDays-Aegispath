import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import OnboardingScreen      from './src/screens/OnboardingScreen';
import HomeScreen            from './src/screens/HomeScreen';
import TravelModeScreen      from './src/screens/TravelModeScreen';
import CabVerificationScreen from './src/screens/CabVerificationScreen';
import RouteComparisonScreen from './src/screens/RouteComparisonScreen';
import NavigationScreen      from './src/screens/NavigationScreen';
import SOSScreen             from './src/screens/SOSScreen';
import IncidentReportScreen  from './src/screens/IncidentReportScreen';
import TimeImpactScreen      from './src/screens/TimeImpactScreen';
import RiskMitigationScreen  from './src/screens/RiskMitigationScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null); // null = loading

  useEffect(() => {
    AsyncStorage.getItem('@aegispath_onboarded').then(val => {
      setInitialRoute(val === 'true' ? 'Home' : 'Onboarding');
    });
  }, []);

  // Don't render navigator until we know which screen to start on.
  // This prevents the welcome screen flashing for returning users.
  if (initialRoute === null) return null;

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="Onboarding"       component={OnboardingScreen} />
          <Stack.Screen name="Home"             component={HomeScreen} />
          <Stack.Screen name="TravelMode"       component={TravelModeScreen} />
          <Stack.Screen name="CabVerification"  component={CabVerificationScreen} />
          <Stack.Screen name="RouteComparison"  component={RouteComparisonScreen} />
          <Stack.Screen name="Navigation"       component={NavigationScreen} />
          <Stack.Screen name="SOS"              component={SOSScreen} />
          <Stack.Screen name="IncidentReport"   component={IncidentReportScreen} />
          <Stack.Screen name="TimeImpact"       component={TimeImpactScreen} />
          <Stack.Screen name="RiskMitigation"   component={RiskMitigationScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
