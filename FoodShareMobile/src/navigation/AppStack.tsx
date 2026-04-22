import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons'; // Professional Vector Icons
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/theme'; 
import HomeScreen from '../screens/student/home/HomeScreen';
import ProfileScreen from '../screens/student/profile/ProfileScreen';
import DashboardScreen from '../screens/restaurant/DashboardScreen';
import AdminPanelScreen from '../screens/admin/AdminPanelScreen';
import ScannerScreen from '../screens/restaurant/ScannerScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator(); 

// --- FALLBACK ERROR SCREEN ---
const ErrorScreen = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>Error: User role is not recognized.</Text>
  </View>
);

// --- STUDENT BOTTOM TAB NAVIGATOR ---
const StudentTabNavigator = () => {
  // Extract the translation function from context
  const { t } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary, 
        tabBarInactiveTintColor: COLORS.placeholder,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          height: 60, 
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontWeight: '700',
          fontSize: 11,
        }
      }}
    >
      {/* EXPLORE TAB */}
      <Tab.Screen 
        name="HomeTab" 
        component={HomeScreen} 
        options={{ 
          // Dynamically translated label based on current language
          tabBarLabel: t('nav_explore'), 
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass-outline" size={size} color={color} />
          ) 
        }} 
      />
      
      {/* PROFILE TAB */}
      <Tab.Screen 
        name="ProfileTab" 
        component={ProfileScreen} 
        options={{ 
          // Dynamically translated label based on current language
          tabBarLabel: t('nav_profile'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          )
        }} 
      />
    </Tab.Navigator>
  );
};

// --- MAIN APPLICATION STACK ---
export const AppStack = () => {
  const { user } = useAuth();

  useEffect(() => {
    console.log("🟢 AppStack Loaded. Active User:", JSON.stringify(user, null, 2));
  }, [user]);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      
      {/* Student now uses the Bottom Tab Navigator */}
      {(user?.role === 'user' || user?.role === 'student') && (
        <Stack.Screen name="StudentMain" component={StudentTabNavigator} />
      )}

      {/* Restaurant Routes */}
      {user?.role === 'restaurant' && (
        <>
          <Stack.Screen name="RestaurantDashboard" component={DashboardScreen} />
          <Stack.Screen name="Scanner" component={ScannerScreen} />
        </>
      )}

      {/* Admin Routes */}
      {user?.role === 'admin' && (
        <Stack.Screen name="AdminPanel" component={AdminPanelScreen} />
      )}

      {/* Fallback Error Route */}
      {!['user', 'student', 'restaurant', 'admin'].includes(user?.role || '') && (
        <Stack.Screen name="Error" component={ErrorScreen} />
      )}

    </Stack.Navigator>
  );
};