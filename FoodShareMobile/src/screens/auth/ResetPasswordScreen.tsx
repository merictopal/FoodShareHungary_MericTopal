import React, { useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api/auth';
import { MIN_PASSWORD_LENGTH } from '../../utils/validation';
import { apiErrorKey } from '../../utils/apiErrors';

import { COLORS } from '../../constants/theme';
import { styles } from './recoveryStyles';

import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Header } from '../../components/Header';


const ResetPasswordScreen = ({ navigation, route }: any) => {
  const { t } = useAuth();

  // Email comes from the forgot-password screen; still editable in case of a typo
  const [email, setEmail] = useState<string>(route?.params?.email || '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !code || !newPassword || !confirmPassword) {
      Alert.alert(t('error'), t('reset_fill_all'));
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      Alert.alert(t('error'), t('reset_password_too_short'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('error'), t('reset_password_mismatch'));
      return;
    }

    setIsLoading(true);

    try {
      const data = await authApi.resetPassword(email.trim(), code.trim(), newPassword);

      if (data.success) {
        Alert.alert(t('success'), t('reset_success'), [
          { text: t('ok'), onPress: () => navigation.navigate('Login') },
        ]);
      }
    } catch (error: any) {
      // 'Invalid Code' is the stable error title from AuthService.reset_password; its message is English-only
      Alert.alert(t('error'), t(apiErrorKey(error, 'generic_error', { 'Invalid Code': 'reset_invalid_code' })));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <Header title="" onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ICON */}
        <View style={styles.iconContainer}>
          <Ionicons name="key-outline" size={34} color={COLORS.primary} />
        </View>

        {/* TITLE */}
        <Text style={styles.title}>{t('reset_title')}</Text>

        {/* DESCRIPTION */}
        <Text style={styles.subtitle}>{t('reset_sub')}</Text>

        {/* FORM CARD */}
        <View style={styles.card}>
          <Input
            label={t('email_ph')}
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Input
            label={t('reset_code_label')}
            icon="keypad-outline"
            placeholder="123456"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
          />

          <Input
            label={t('new_password_label')}
            icon="lock-closed-outline"
            value={newPassword}
            onChangeText={setNewPassword}
            isPassword
            autoCapitalize="none"
          />

          <Input
            label={t('confirm_password_label')}
            icon="lock-closed-outline"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            isPassword
            autoCapitalize="none"
          />

          <Button
            title={t('reset_submit_btn')}
            onPress={handleSubmit}
            loading={isLoading}
            variant="primary"
            icon={
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color={COLORS.white}
              />
            }
          />

          <Button
            title={t('back_to_login')}
            onPress={() => navigation.navigate('Login')}
            variant="outline"
            style={styles.backButton}
            icon={
              <Ionicons
                name="arrow-back-outline"
                size={18}
                color={COLORS.primary}
              />
            }
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default ResetPasswordScreen;
