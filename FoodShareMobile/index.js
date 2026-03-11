/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
// Import Firebase Messaging module
import messaging from '@react-native-firebase/messaging';

// Register background handler
// This listener processes notifications when the app is in the background or completely closed (quit state)
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Message handled in the background!', remoteMessage);
});

AppRegistry.registerComponent(appName, () => App);