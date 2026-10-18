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
import { client } from '../../api/client';

import { COLORS } from '../../constants/theme';
import { styles } from './recoveryStyles';

import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Header } from '../../components/Header';
import { apiErrorKey } from '../../utils/apiErrors';

const ForgotPasswordScreen = ({ navigation }: any) => {
  const { t } = useAuth();

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert(
        t('error') || 'Error',
        t('invalid_email') ||
          'Please enter your email.',
      );
      return;
    }

    setIsLoading(true);

    try {
      const response = await client.post(
        '/auth/forgot-password',
        { email },
      );

      if (response.data.success) {
        Alert.alert(
          t('success'),
          t('reset_sent_success'),
          [
            {
              text: t('ok'),
              // Continue to the code entry screen; the email is carried over
              onPress: () =>
                navigation.navigate('ResetPassword', { email }),
            },
          ],
        );
      }
    } catch (error: any) {
      const msg = t(apiErrorKey(error, 'generic_error'));

      Alert.alert(
        t('error') || 'Error',
        msg,
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : 'height'
      }
      style={styles.container}
    >
      <Header
        title=""
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ICON */}
        <View style={styles.iconContainer}>
          <Ionicons
            name="lock-open-outline"
            size={34}
            color={COLORS.primary}
          />
        </View>

        {/* TITLE */}
        <Text style={styles.title}>
          {t('forgot_title')}
        </Text>

        {/* DESCRIPTION */}
        <Text style={styles.subtitle}>
          {t('forgot_sub')}
        </Text>

        {/* FORM CARD */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={COLORS.primary}
              />
            </View>

            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>
                {t('recovery_email_title')}
              </Text>

              <Text style={styles.cardSubtitle}>
                {t('recovery_email_sub')}
              </Text>
            </View>
          </View>

          <Input
            label={t('email_ph')}
            icon="mail-outline"
            placeholder="example@student.hu"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Button
            title={t('send_reset_btn')}
            onPress={handleResetPassword}
            loading={isLoading}
            variant="primary"
            icon={
              <Ionicons
                name="paper-plane-outline"
                size={18}
                color={COLORS.white}
              />
            }
          />

          <Button
            title={t('back_to_login')}
            onPress={() =>
              navigation.goBack()
            }
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

        {/* SECURITY NOTE */}
        <View style={styles.securityNote}>
          <Ionicons
            name="shield-checkmark-outline"
            size={18}
            color={COLORS.success}
          />

          <Text style={styles.securityText}>
            {t('recovery_security_note')}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default ForgotPasswordScreen;