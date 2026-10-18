import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Image,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { useAuth } from '../../context/AuthContext';
import {
  COLORS,
  SIZES,
  SPACING,
  SHADOWS,
  TYPOGRAPHY,
} from '../../constants/theme';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { isValidEmail } from '../../utils/validation';

import {
  GoogleSignin,
  GoogleSigninButton,
} from '@react-native-google-signin/google-signin';

const LoginScreen = ({ navigation }: any) => {
  const {
    login,
    loginWithGoogle,
    isLoading,
    t,
    changeLanguage,
    lang,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const handleLogin = async () => {
    // Show what is missing next to the field instead of silently ignoring the tap.
    // Errors hold translation keys so they follow a language switch.
    const nextErrors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      nextErrors.email = 'field_required';
    } else if (!isValidEmail(email)) {
      nextErrors.email = 'invalid_email';
    }
    if (!password) {
      nextErrors.password = 'field_required';
    }
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;

    try {
      await login(email, password);
    } catch (e) {
      console.log('Standard login failed.');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });

      const userInfo = await GoogleSignin.signIn();

      const idToken =
        userInfo?.data?.idToken ||
        userInfo?.idToken;

      if (idToken) {
        await loginWithGoogle(idToken);
      } else {
        throw new Error(
          'No ID token received from Google payload',
        );
      }
    } catch (error: any) {
      console.log(
        'Google Sign-In Error or User Cancelled the flow:',
        error,
      );
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
      <StatusBar
        barStyle="dark-content"
        backgroundColor={COLORS.background}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* TOP BAR */}
        <View style={styles.topBar}>
          <View style={styles.languageSwitcher}>
            {['tr', 'en', 'hu'].map((language) => {
              const active = lang === language;

              return (
                <TouchableOpacity
                  key={language}
                  onPress={() =>
                    changeLanguage(language)
                  }
                  activeOpacity={0.75}
                  style={[
                    styles.languageButton,
                    active &&
                      styles.languageButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.languageText,
                      active &&
                        styles.languageTextActive,
                    ]}
                  >
                    {language.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* BRAND / WELCOME */}
        <View style={styles.hero}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.welcomeTitle}>
            {t('login_title')}
          </Text>

          <Text style={styles.welcomeSubtitle}>
            {t('login_sub')}
          </Text>
        </View>

        {/* LOGIN CARD */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              {t('sign_in')}
            </Text>

            <Text style={styles.cardSubtitle}>
              {t('login_card_sub')}
            </Text>
          </View>

          {/* EMAIL */}
          <Input
            label={t('email_ph')}
            icon="mail-outline"
            placeholder="example@student.hu"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            error={errors.email && t(errors.email)}
          />

          {/* PASSWORD */}
          <Input
            label={t('pass_ph')}
            icon="lock-closed-outline"
            placeholder="••••••••"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            isPassword
            error={errors.password && t(errors.password)}
          />

          {/* FORGOT PASSWORD */}
          <View style={styles.forgotContainer}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() =>
                navigation.navigate(
                  'ForgotPassword',
                )
              }
            >
              <Text style={styles.forgotText}>
                {t('forgot_pass')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* LOGIN */}
          <Button
            title={t('login_btn')}
            onPress={handleLogin}
            loading={isLoading}
            variant="primary"
            icon={
              <Ionicons
                name="arrow-forward-outline"
                size={19}
                color={COLORS.white}
              />
            }
          />

          {/* DIVIDER */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />

            <View style={styles.orBadge}>
              <Text style={styles.orText}>
                {t('or')}
              </Text>
            </View>

            <View style={styles.dividerLine} />
          </View>

          {/* GOOGLE */}
          <View style={styles.googleWrapper}>
            <GoogleSigninButton
              size={GoogleSigninButton.Size.Wide}
              color={GoogleSigninButton.Color.Light}
              onPress={handleGoogleLogin}
              disabled={isLoading}
              style={styles.googleButton}
            />
          </View>
        </View>

        {/* REGISTER */}
        <View style={styles.registerFooter}>
          <Text style={styles.registerText}>
            {t('no_acc')}{' '}
          </Text>

          <TouchableOpacity
            onPress={() =>
              navigation.navigate('Register')
            }
            activeOpacity={0.7}
          >
            <Text style={styles.registerLink}>
              {t('register_btn')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* SMALL FOOTNOTE */}
        <View style={styles.footerInfo}>
          <Ionicons
            name="leaf-outline"
            size={15}
            color={COLORS.success}
          />

          <Text style={styles.footerInfoText}>
            FoodShare Hungary
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xxl,
    paddingTop:
      Platform.OS === 'android'
        ? (StatusBar.currentHeight || 0) + 8
        : 20,
    paddingBottom: SPACING.xxxl,
  },

  /* ---------------- TOP BAR ---------------- */

  topBar: {
    alignItems: 'flex-end',
    marginBottom: SPACING.xxl,
  },

  languageSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',

    backgroundColor: COLORS.surface,

    padding: 4,

    borderRadius: SIZES.radiusFull,
    borderWidth: 1,
    borderColor: COLORS.border,

    ...SHADOWS.light,
  },

  languageButton: {
    minWidth: 40,
    paddingVertical: 7,
    paddingHorizontal: 9,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: SIZES.radiusFull,
  },

  languageButtonActive: {
    backgroundColor: COLORS.primaryLight,
  },

  languageText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.3,
  },

  languageTextActive: {
    color: COLORS.primary,
  },

  /* ---------------- HERO ---------------- */

  hero: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },

  logoContainer: {
    width: 88,
    height: 88,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.surface,

    borderRadius: SIZES.radiusFull,
    borderWidth: 1,
    borderColor: COLORS.border,

    marginBottom: SPACING.lg,

    ...SHADOWS.medium,
  },

  logo: {
    width: 56,
    height: 56,
  },

  welcomeTitle: {
    ...TYPOGRAPHY.display,

    color: COLORS.textMain,
    textAlign: 'center',
  },

  welcomeSubtitle: {
    marginTop: SPACING.sm,

    maxWidth: 300,

    fontSize: 15,
    lineHeight: 22,

    color: COLORS.textSub,

    textAlign: 'center',
  },

  /* ---------------- LOGIN CARD ---------------- */

  card: {
    width: '100%',

    backgroundColor: COLORS.surface,

    borderRadius: SIZES.radiusXl,

    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.xxl,

    borderWidth: 1,
    borderColor: COLORS.border,

    ...SHADOWS.medium,
  },

  cardHeader: {
    marginBottom: SPACING.xxl,
  },

  cardTitle: {
    ...TYPOGRAPHY.heading,

    fontSize: 21,
    color: COLORS.textMain,
  },

  cardSubtitle: {
    marginTop: SPACING.xs,

    fontSize: 13,
    lineHeight: 19,

    color: COLORS.textMuted,
  },

  /* ---------------- FORGOT ---------------- */

  forgotContainer: {
    alignItems: 'flex-end',

    marginTop: -SPACING.sm,
    marginBottom: SPACING.lg,
  },

  forgotText: {
    color: COLORS.primary,

    fontSize: 13,
    fontWeight: '700',
  },

  /* ---------------- DIVIDER ---------------- */

  divider: {
    flexDirection: 'row',
    alignItems: 'center',

    marginVertical: SPACING.xxl,
  },

  dividerLine: {
    flex: 1,
    height: 1,

    backgroundColor: COLORS.divider,
  },

  orBadge: {
    marginHorizontal: SPACING.md,

    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,

    backgroundColor: COLORS.surfaceMuted,

    borderRadius: SIZES.radiusFull,
  },

  orText: {
    fontSize: 11,
    fontWeight: '800',

    color: COLORS.textMuted,

    letterSpacing: 0.5,
  },

  /* ---------------- GOOGLE ---------------- */

  googleWrapper: {
    width: '100%',
    alignItems: 'center',
  },

  googleButton: {
    width: '100%',
    height: 52,
  },

  /* ---------------- REGISTER ---------------- */

  registerFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',

    marginTop: SPACING.xxl,
  },

  registerText: {
    fontSize: 14,
    color: COLORS.textSub,
  },

  registerLink: {
    fontSize: 14,
    fontWeight: '800',

    color: COLORS.primary,

    textDecorationLine: 'none',
  },

  /* ---------------- FOOTER ---------------- */

  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    marginTop: SPACING.xxl,
    gap: SPACING.xs,
  },

  footerInfoText: {
    fontSize: 11,
    fontWeight: '600',

    color: COLORS.textMuted,

    letterSpacing: 0.2,
  },
});

export default LoginScreen;