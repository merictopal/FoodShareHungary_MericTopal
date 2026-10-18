import React, { useEffect } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// Import Firebase Messaging module
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TRANSLATIONS } from './src/constants/translations';

import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { AppNavigator } from './src/navigation/AppNavigator';

// App sits outside AuthProvider (no t()), so the fallback text reads the stored app language directly.
// Same storage key and default ('tr') as AuthContext; English when a key is missing.
const translateStored = async (key: string): Promise<string> => {
  let lang = 'tr';
  try {
    lang = (await AsyncStorage.getItem('@FoodShare_Lang')) || 'tr';
  } catch {
    // keep the default
  }
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key];
};

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

      // 2. We only request permission and log the token here.
      // We DO NOT send it to backend here because the user might not be logged in yet.
      // The actual sending to backend is securely handled inside AuthContext.tsx when a user logs in.
      try {
        // The token itself is never logged: it identifies this device for push delivery.
        await messaging().getToken();
        // Removed authApi.updateFcmToken() from here to prevent the "No token available" crash on startup.
      } catch (error: any) {
        console.error('Error fetching FCM token:', error);
      }
    };

    // FIX: Delay the permission request slightly to ensure the Android Activity is fully attached to the view.
    const permissionTimeout = setTimeout(() => {
      requestNotificationPermission();
    }, 1000);

    // 3. Listen for real-time messages when the app is in the foreground
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      const title = remoteMessage.notification?.title || (await translateStored('push_fallback_title'));
      const body = remoteMessage.notification?.body || (await translateStored('push_fallback_body'));
      
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