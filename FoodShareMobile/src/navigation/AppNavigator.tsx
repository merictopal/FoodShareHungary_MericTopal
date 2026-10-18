import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

import { AuthStack } from './AuthStack';
import { AppStack } from './AppStack';

export const AppNavigator = () => {
  const { user } = useAuth();

  // No full-screen spinner here: AuthProvider renders nothing until the stored session is loaded,
  // and `isLoading` (login/register/logout) is shown on the buttons instead. Replacing the
  // navigator with a spinner unmounted the auth screens and wiped the form after a failed login.
  return (
    <NavigationContainer>
      {user ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
};
