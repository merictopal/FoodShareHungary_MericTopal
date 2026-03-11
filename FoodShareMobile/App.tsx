import React, { useEffect } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// Import Firebase Messaging module
import messaging from '@react-native-firebase/messaging';

import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { AppNavigator } from './src/navigation/AppNavigator';

const App = () => {
  
  useEffect(() => {
    // Function to request notification permissions and get the FCM token
    const requestNotificationPermission = async () => {
      // 1. Request permission for Android 13+ (API 33+)
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            console.log('Notification permission denied by user.');
            return;
          }
        } catch (err) {
          console.warn('Permission request error:', err);
        }
      }

      // 2. Get the unique device token for Push Notifications
      try {
        console.log('Requesting Firebase token from Google servers...');
        const token = await messaging().getToken();
        
        // Log the token silently to the terminal for debugging purposes
        console.log('🔥 FIREBASE FCM TOKEN:', token);
        
      } catch (error: any) {
        console.error('Error fetching FCM token:', error);
      }
    };

    // FIX: Delay the permission request slightly to ensure the Android Activity is fully attached to the view.
    // 1000ms (1 second) is usually enough for React Native to finish rendering the initial layout.
    const permissionTimeout = setTimeout(() => {
      requestNotificationPermission();
    }, 1000);

    // 3. Listen for real-time messages when the app is in the foreground
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      const title = remoteMessage.notification?.title || 'New Alert! 🔔';
      const body = remoteMessage.notification?.body || 'Check out the new offers.';
      
      // Keep showing alerts only for incoming real-time messages
      Alert.alert(title, body);
    });

    // Cleanup the listener and timeout when the component unmounts
    return () => {
      clearTimeout(permissionTimeout);
      unsubscribe();
    };
  }, []);

  // Return the main app structure
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

export default App;