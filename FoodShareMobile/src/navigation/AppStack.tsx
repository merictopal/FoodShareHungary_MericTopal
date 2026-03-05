import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';

import HomeScreen from '../screens/student/HomeScreen';
import ProfileScreen from '../screens/student/ProfileScreen';
import DashboardScreen from '../screens/restaurant/DashboardScreen';
import AdminPanelScreen from '../screens/admin/AdminPanelScreen';
// Import the newly created Scanner screen for restaurants
import ScannerScreen from '../screens/restaurant/ScannerScreen';

const Stack = createNativeStackNavigator();

const ErrorScreen = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>Error: User role is not recognized.</Text>
  </View>
);

export const AppStack = () => {
  const { user } = useAuth();

  useEffect(() => {
    console.log("🟢 AppStack Loaded. Active User:", JSON.stringify(user, null, 2));
  }, [user]);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      
      {/* Student Routes */}
      {user?.role === 'student' && (
        <>
          <Stack.Screen name="StudentHome" component={HomeScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
        </>
      )}

      {/* Restaurant Routes */}
      {user?.role === 'restaurant' && (
        <>
          <Stack.Screen name="RestaurantDashboard" component={DashboardScreen} />
          {/* Add ScannerScreen specifically for restaurant users */}
          <Stack.Screen name="Scanner" component={ScannerScreen} />
        </>
      )}

      {/* Admin Routes */}
      {user?.role === 'admin' && (
        <Stack.Screen name="AdminPanel" component={AdminPanelScreen} />
      )}

      {/* Fallback Error Route */}
      {!['student', 'restaurant', 'admin'].includes(user?.role || '') && (
        <Stack.Screen name="Error" component={ErrorScreen} />
      )}

    </Stack.Navigator>
  );
};