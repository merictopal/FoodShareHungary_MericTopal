import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Modal,
  SafeAreaView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api/auth';
import {
  COLORS,
  SIZES,
  SPACING,
  SHADOWS,
  TYPOGRAPHY,
} from '../../constants/theme';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Header } from '../../components/Header';
import { isValidEmail, MIN_PASSWORD_LENGTH } from '../../utils/validation';
import { apiErrorKey } from '../../utils/apiErrors';

const RegisterScreen = ({ navigation }: any) => {
  const { register, login, isLoading, t } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Inline field errors (translation keys, translated at render); the same checks as before
  type FieldErrors = Partial<Record<
    'name' | 'email' | 'dob' | 'password' | 'confirmPassword' | 'address' | 'terms',
    string
  >>;
  const [errors, setErrors] = useState<FieldErrors>({});
  // Restaurant sign-up bypasses the context's register(), so it tracks its own busy state
  const [submittingRestaurant, setSubmittingRestaurant] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const clearError = (field: keyof FieldErrors) => {
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const [displayRole, setDisplayRole] = useState<
    'student' | 'restaurant'
  >('student');

  const [gender, setGender] = useState('');
  const [occupation, setOccupation] = useState('');
  const [university, setUniversity] = useState('');
  const [major, setMajor] = useState('');
  const [studyYear, setStudyYear] = useState('');

  const genderOptions = [
    {
      id: 'Male',
      label: t('gender_male'),
    },
    {
      id: 'Female',
      label: t('gender_female'),
    },
    {
      id: 'Prefer not to say',
      label: t('gender_prefer_not'),
    },
  ];

  const validateAge = (dobStr: string) => {
    const parts = dobStr.split('/');

    if (parts.length !== 3) return false;

    const year = parseInt(parts[2], 10);

    if (2026 - year < 18) return false;

    return true;
  };

  const handleDobChange = (text: string) => {
    if (text.length < dob.length) {
      setDob(text);
      return;
    }

    const cleaned = text.replace(/\D/g, '');
    let formatted = cleaned;

    if (cleaned.length >= 5) {
      formatted = `${cleaned.slice(
        0,
        2,
      )}/${cleaned.slice(
        2,
        4,
      )}/${cleaned.slice(4, 8)}`;
    } else if (cleaned.length === 4) {
      formatted = `${cleaned.slice(
        0,
        2,
      )}/${cleaned.slice(2, 4)}/`;
    } else if (cleaned.length >= 3) {
      formatted = `${cleaned.slice(
        0,
        2,
      )}/${cleaned.slice(2)}`;
    } else if (cleaned.length === 2) {
      formatted = `${cleaned}/`;
    }

    setDob(formatted);
  };

  const handleRegister = async () => {
    const nextErrors: FieldErrors = {};

    if (!name) nextErrors.name = 'field_required';

    if (!email) nextErrors.email = 'field_required';
    else if (!isValidEmail(email)) nextErrors.email = 'invalid_email';

    if (!dob) nextErrors.dob = 'field_required';
    else if (!validateAge(dob)) nextErrors.dob = 'age_restriction_msg';

    if (displayRole === 'restaurant' && !address) {
      nextErrors.address = 'address_required';
    }

    if (!password) nextErrors.password = 'field_required';
    else if (password.length < MIN_PASSWORD_LENGTH) nextErrors.password = 'reset_password_too_short';

    if (!confirmPassword) nextErrors.confirmPassword = 'field_required';
    else if (password && password !== confirmPassword) {
      nextErrors.confirmPassword = 'reset_password_mismatch';
    }

    if (!agreedToTerms) nextErrors.terms = 'terms_required_msg';

    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      // Field errors sit above the fold; the terms error is right next to the button
      const onlyTerms = Object.keys(nextErrors).every((key) => key === 'terms');
      if (!onlyTerms) {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
      return;
    }

    const backendRole =
      displayRole === 'student'
        ? 'student'
        : 'restaurant';

    const payload = {
      name,
      email,
      password,
      role: backendRole,
      phone,
      date_of_birth: dob,
      address:
        displayRole === 'restaurant'
          ? address
          : undefined,
      gender,
      occupation:
        displayRole === 'student'
          ? occupation
          : undefined,
      university:
        displayRole === 'student'
          ? university
          : undefined,
      major:
        displayRole === 'student'
          ? major
          : undefined,
      study_year:
        displayRole === 'student'
          ? studyYear
          : undefined,
    };

    if (backendRole === 'restaurant') {
      // A new restaurant stays pending until an admin approves it, so logging in now would always be
      // refused (403). Show one message and return to the login screen instead.
      setSubmittingRestaurant(true);
      try {
        await authApi.register(payload);
        Alert.alert(t('success'), t('msg_reg_success_rest'), [
          { text: t('ok'), onPress: () => navigation.navigate('Login') },
        ]);
      } catch (e: any) {
        Alert.alert(t('error'), t(apiErrorKey(e, 'generic_error')));
      } finally {
        setSubmittingRestaurant(false);
      }
      return;
    }

    try {
      await register(payload);
      await login(email, password);
    } catch {
      // register()/login() in AuthContext have already shown the error alert
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
        title={t('register_title')}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* INTRO */}
        <View style={styles.intro}>
          <View style={styles.introIcon}>
            <Ionicons
              name="person-add-outline"
              size={24}
              color={COLORS.primary}
            />
          </View>

          <Text style={styles.title}>
            {t('register_title')}
          </Text>

          <Text style={styles.subtitle}>
            {t('register_sub')}
          </Text>
        </View>

        {/* ROLE SELECTOR */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {t('register_as')}
          </Text>

          <View style={styles.roleContainer}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() =>
                setDisplayRole('student')
              }
              style={[
                styles.roleCard,
                displayRole === 'student' &&
                  styles.roleCardActive,
              ]}
            >
              <View
                style={[
                  styles.roleIcon,
                  displayRole === 'student' &&
                    styles.roleIconActive,
                ]}
              >
                <Ionicons
                  name="school-outline"
                  size={22}
                  color={
                    displayRole === 'student'
                      ? COLORS.white
                      : COLORS.primary
                  }
                />
              </View>

              <View style={styles.roleTextContainer}>
                <Text
                  style={[
                    styles.roleTitle,
                    displayRole === 'student' &&
                      styles.roleTitleActive,
                  ]}
                >
                  {t('role_student')}
                </Text>

                <Text
                  style={[
                    styles.roleDescription,
                    displayRole === 'student' &&
                      styles.roleDescriptionActive,
                  ]}
                >
                  {t('role_student_desc')}
                </Text>
              </View>

              {displayRole === 'student' && (
                <Ionicons
                  name="checkmark-circle"
                  size={22}
                  color={COLORS.primary}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() =>
                setDisplayRole('restaurant')
              }
              style={[
                styles.roleCard,
                displayRole === 'restaurant' &&
                  styles.roleCardActive,
              ]}
            >
              <View
                style={[
                  styles.roleIcon,
                  displayRole === 'restaurant' &&
                    styles.roleIconActive,
                ]}
              >
                <Ionicons
                  name="restaurant-outline"
                  size={22}
                  color={
                    displayRole === 'restaurant'
                      ? COLORS.white
                      : COLORS.primary
                  }
                />
              </View>

              <View style={styles.roleTextContainer}>
                <Text
                  style={[
                    styles.roleTitle,
                    displayRole === 'restaurant' &&
                      styles.roleTitleActive,
                  ]}
                >
                  {t('role_rest')}
                </Text>

                <Text
                  style={[
                    styles.roleDescription,
                    displayRole === 'restaurant' &&
                      styles.roleDescriptionActive,
                  ]}
                >
                  {t('role_rest_desc')}
                </Text>
              </View>

              {displayRole === 'restaurant' && (
                <Ionicons
                  name="checkmark-circle"
                  size={22}
                  color={COLORS.primary}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* BASIC INFORMATION */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionNumber}>
              <Text style={styles.sectionNumberText}>
                1
              </Text>
            </View>

            <View>
              <Text style={styles.sectionTitle}>
                {t('section_basic_title')}
              </Text>

              <Text style={styles.sectionSubtitle}>
                {t('section_basic_sub')}
              </Text>
            </View>
          </View>

          <Input
            label={
              displayRole === 'student'
                ? t('name_student_ph')
                : t('name_rest_ph')
            }
            icon={
              displayRole === 'student'
                ? 'person-outline'
                : 'storefront-outline'
            }
            placeholder={
              displayRole === 'student'
                ? t('ph_name_student')
                : t('ph_offer_name')
            }
            value={name}
            onChangeText={(text) => {
              setName(text);
              clearError('name');
            }}
            error={errors.name && t(errors.name)}
            autoCapitalize="words"
          />

          <Input
            label={t('email_ph')}
            icon="mail-outline"
            placeholder={t('ph_email')}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              clearError('email');
            }}
            error={errors.email && t(errors.email)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Input
            label={t('dob')}
            icon="calendar-outline"
            placeholder={t('dob_ph')}
            value={dob}
            onChangeText={(text) => {
              handleDobChange(text);
              clearError('dob');
            }}
            error={errors.dob && t(errors.dob)}
            keyboardType="numeric"
            maxLength={10}
          />

          {/* GENDER */}
          <Text style={styles.fieldLabel}>
            {t('gender_optional')}
          </Text>

          <View style={styles.chipRow}>
            {genderOptions.map((item) => {
              const active = gender === item.id;

              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.8}
                  onPress={() =>
                    setGender(item.id)
                  }
                  style={[
                    styles.chip,
                    active && styles.chipActive,
                  ]}
                >
                  {active && (
                    <Ionicons
                      name="checkmark"
                      size={14}
                      color={COLORS.white}
                    />
                  )}

                  <Text
                    style={[
                      styles.chipText,
                      active &&
                        styles.chipTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Input
            label={t('phone_optional')}
            icon="call-outline"
            placeholder="+36 30 123 4567"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>

        {/* STUDENT INFORMATION */}
        {displayRole === 'student' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionNumber}>
                <Text style={styles.sectionNumberText}>
                  2
                </Text>
              </View>

              <View>
                <Text style={styles.sectionTitle}>
                  {t('section_student_title')}
                </Text>

                <Text style={styles.sectionSubtitle}>
                  {t('section_student_sub')}
                </Text>
              </View>
            </View>

            <Input
              label={t('occupation_optional')}
              icon="briefcase-outline"
              placeholder={t('ph_occupation')}
              value={occupation}
              onChangeText={setOccupation}
              autoCapitalize="words"
            />

            <Input
              label={t('uni_optional')}
              icon="school-outline"
              placeholder={t('ph_university')}
              value={university}
              onChangeText={setUniversity}
              autoCapitalize="words"
            />

            <Input
              label={t('major_optional')}
              icon="book-outline"
              placeholder={t('ph_major')}
              value={major}
              onChangeText={setMajor}
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>
              {t('study_year_optional')}
            </Text>

            <View style={styles.chipRow}>
              {[
                '1st',
                '2nd',
                '3rd',
                '4th',
                '5+',
              ].map((item) => {
                const active =
                  studyYear === item;

                return (
                  <TouchableOpacity
                    key={item}
                    activeOpacity={0.8}
                    onPress={() =>
                      setStudyYear(item)
                    }
                    style={[
                      styles.chip,
                      active &&
                        styles.chipActive,
                    ]}
                  >
                    {active && (
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={COLORS.white}
                      />
                    )}

                    <Text
                      style={[
                        styles.chipText,
                        active &&
                          styles.chipTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* RESTAURANT INFORMATION */}
        {displayRole === 'restaurant' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionNumber}>
                <Text style={styles.sectionNumberText}>
                  2
                </Text>
              </View>

              <View>
                <Text style={styles.sectionTitle}>
                  {t('section_rest_title')}
                </Text>

                <Text style={styles.sectionSubtitle}>
                  {t('section_rest_sub')}
                </Text>
              </View>
            </View>

            <Input
              label={
                t('address_ph') ||
                'Restaurant Address'
              }
              icon="location-outline"
              placeholder="1051 Budapest, Szent István tér"
              value={address}
              onChangeText={(text) => {
                setAddress(text);
                clearError('address');
              }}
              error={errors.address && t(errors.address)}
              autoCapitalize="words"
            />
          </View>
        )}

        {/* SECURITY */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionNumber}>
              <Text style={styles.sectionNumberText}>
                {displayRole === 'student'
                  ? '3'
                  : '3'}
              </Text>
            </View>

            <View>
              <Text style={styles.sectionTitle}>
                {t('security')}
              </Text>

              <Text style={styles.sectionSubtitle}>
                {t('section_security_sub')}
              </Text>
            </View>
          </View>

          <Input
            label={t('secure_pass')}
            icon="lock-closed-outline"
            placeholder={t('ph_password')}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              clearError('password');
            }}
            error={errors.password && t(errors.password)}
            isPassword
          />

          <Input
            label={t('confirm_pass')}
            icon="shield-checkmark-outline"
            placeholder={t('confirm_pass_ph')}
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              clearError('confirmPassword');
            }}
            error={errors.confirmPassword && t(errors.confirmPassword)}
            isPassword
          />
        </View>

        {/* TERMS */}
        <View style={styles.termsCard}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              setAgreedToTerms(!agreedToTerms);
              clearError('terms');
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreedToTerms }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[
              styles.checkbox,
              agreedToTerms &&
                styles.checkboxActive,
            ]}
          >
            {agreedToTerms && (
              <Ionicons
                name="checkmark"
                size={16}
                color={COLORS.white}
              />
            )}
          </TouchableOpacity>

          <Text style={styles.termsText}>
            {/* Prefix/middle/suffix are separate keys because word order differs between EN/HU/TR */}
            {t('terms_agree_prefix')}
            <Text
              style={styles.termsLink}
              onPress={() =>
                setShowTermsModal(true)
              }
            >
              {t('terms_of_service')}
            </Text>
            {t('terms_agree_middle')}
            <Text
              style={styles.termsLink}
              onPress={() =>
                setShowTermsModal(true)
              }
            >
              {t('privacy_policy')}
            </Text>
            {t('terms_agree_suffix')}
          </Text>
        </View>

        {errors.terms && (
          <View style={styles.termsError}>
            <Ionicons
              name="alert-circle-outline"
              size={14}
              color={COLORS.danger}
            />
            <Text style={styles.termsErrorText}>
              {t(errors.terms)}
            </Text>
          </View>
        )}

        {/* REGISTER */}
        <Button
          title={t('register_btn')}
          onPress={handleRegister}
          loading={isLoading || submittingRestaurant}
          variant="primary"
          icon={
            <Ionicons
              name="arrow-forward-outline"
              size={19}
              color={COLORS.white}
            />
          }
        />

        {/* LOGIN LINK */}
        <View style={styles.loginFooter}>
          <Text style={styles.loginText}>
            {t('has_acc')}{' '}
          </Text>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() =>
              navigation.goBack()
            }
          >
            <Text style={styles.loginLink}>
              {t('sign_in')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* LEGAL MODAL */}
      <Modal
        visible={showTermsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() =>
          setShowTermsModal(false)
        }
      >
        <SafeAreaView
          style={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalEyebrow}>
                FOODSHARE
              </Text>

              <Text style={styles.modalTitle}>
                {t('legal_title')}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() =>
                setShowTermsModal(false)
              }
              style={styles.closeButton}
              activeOpacity={0.75}
            >
              <Ionicons
                name="close"
                size={22}
                color={COLORS.textMain}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalBody}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.modalHeading}>
              1. {t('terms_of_service')}
            </Text>

            <Text style={styles.modalText}>
              {t('legal_tos_body')}
            </Text>

            <Text style={styles.modalHeading}>
              2. {t('privacy_policy')}
            </Text>

            <Text style={styles.modalText}>
              {t('legal_privacy_body')}
            </Text>

            <Text style={styles.modalHeading}>
              3. {t('legal_docs_heading')}
            </Text>

            <Text style={styles.modalText}>
              {t('legal_docs_body')}
            </Text>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button
              title={t('legal_accept_btn')}
              onPress={() => {
                setAgreedToTerms(true);
                clearError('terms');
                setShowTermsModal(false);
              }}
              variant="primary"
            />
          </View>
        </SafeAreaView>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxxl,
  },

  /* ---------------- INTRO ---------------- */

  intro: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },

  introIcon: {
    width: 54,
    height: 54,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.primaryLight,

    borderRadius: SIZES.radiusMd,

    marginBottom: SPACING.md,
  },

  title: {
    ...TYPOGRAPHY.title,

    color: COLORS.textMain,
    textAlign: 'center',
  },

  subtitle: {
    marginTop: SPACING.sm,

    fontSize: 14,
    lineHeight: 21,

    color: COLORS.textSub,

    textAlign: 'center',

    maxWidth: 320,
  },

  /* ---------------- SECTIONS ---------------- */

  section: {
    backgroundColor: COLORS.surface,

    borderRadius: SIZES.radiusXl,

    borderWidth: 1,
    borderColor: COLORS.border,

    padding: SPACING.xxl,

    marginBottom: SPACING.lg,

    ...SHADOWS.light,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',

    marginBottom: SPACING.xxl,
  },

  sectionNumber: {
    width: 34,
    height: 34,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: SIZES.radiusFull,

    backgroundColor: COLORS.primaryLight,

    marginRight: SPACING.md,
  },

  sectionNumberText: {
    fontSize: 13,
    fontWeight: '800',

    color: COLORS.primary,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',

    color: COLORS.textMain,
  },

  sectionSubtitle: {
    marginTop: 2,

    fontSize: 12,

    color: COLORS.textMuted,
  },

  /* ---------------- ROLE ---------------- */

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',

    color: COLORS.textMain,

    marginBottom: SPACING.sm,
    marginLeft: SPACING.xs,
  },

  roleContainer: {
    gap: SPACING.sm,
  },

  roleCard: {
    minHeight: 76,

    flexDirection: 'row',
    alignItems: 'center',

    padding: SPACING.md,

    backgroundColor: COLORS.surface,

    borderRadius: SIZES.radiusMd,

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  roleCardActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },

  roleIcon: {
    width: 44,
    height: 44,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: SIZES.radius,

    backgroundColor: COLORS.primaryLight,

    marginRight: SPACING.md,
  },

  roleIconActive: {
    backgroundColor: COLORS.primary,
  },

  roleTextContainer: {
    flex: 1,
  },

  roleTitle: {
    fontSize: 15,
    fontWeight: '800',

    color: COLORS.textMain,
  },

  roleTitleActive: {
    color: COLORS.primary,
  },

  roleDescription: {
    marginTop: 3,

    fontSize: 12,

    color: COLORS.textMuted,
  },

  roleDescriptionActive: {
    color: COLORS.textSub,
  },

  /* ---------------- FIELDS ---------------- */

  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',

    color: COLORS.textMain,

    marginBottom: SPACING.sm,
    marginLeft: SPACING.xs,
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',

    gap: SPACING.sm,

    marginBottom: SPACING.lg,
  },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',

    paddingVertical: 9,
    paddingHorizontal: 13,

    borderRadius: SIZES.radiusFull,

    borderWidth: 1,
    borderColor: COLORS.border,

    backgroundColor: COLORS.surface,
  },

  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  chipText: {
    fontSize: 12,
    fontWeight: '600',

    color: COLORS.textSub,
  },

  chipTextActive: {
    color: COLORS.white,

    marginLeft: 4,
  },

  /* ---------------- TERMS ---------------- */

  termsCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',

    padding: SPACING.lg,

    marginBottom: SPACING.lg,

    backgroundColor: COLORS.surface,

    borderRadius: SIZES.radiusMd,

    borderWidth: 1,
    borderColor: COLORS.border,

    ...SHADOWS.light,
  },

  checkbox: {
    width: 22,
    height: 22,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 6,

    borderWidth: 1.5,
    borderColor: COLORS.borderStrong,

    backgroundColor: COLORS.surface,

    marginRight: SPACING.md,
    marginTop: 1,
  },

  checkboxActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  termsText: {
    flex: 1,

    fontSize: 13,
    lineHeight: 20,

    color: COLORS.textSub,
  },

  termsLink: {
    color: COLORS.primary,

    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  termsError: {
    flexDirection: 'row',
    alignItems: 'center',

    marginTop: -SPACING.sm,
    marginBottom: SPACING.lg,
    marginLeft: SPACING.xs,
  },

  termsErrorText: {
    marginLeft: SPACING.xs,

    fontSize: 12,
    fontWeight: '500',

    color: COLORS.danger,
  },

  /* ---------------- FOOTER ---------------- */

  loginFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    marginTop: SPACING.lg,
  },

  loginText: {
    fontSize: 14,

    color: COLORS.textSub,
  },

  loginLink: {
    fontSize: 14,
    fontWeight: '800',

    color: COLORS.primary,
  },

  /* ---------------- MODAL ---------------- */

  modalContainer: {
    flex: 1,

    backgroundColor: COLORS.background,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,

    backgroundColor: COLORS.surface,

    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  modalEyebrow: {
    fontSize: 10,
    fontWeight: '800',

    color: COLORS.primary,

    letterSpacing: 1,
  },

  modalTitle: {
    marginTop: 2,

    fontSize: 20,
    fontWeight: '800',

    color: COLORS.textMain,
  },

  closeButton: {
    width: 42,
    height: 42,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: SIZES.radius,

    backgroundColor: COLORS.surfaceSecondary,

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  modalBody: {
    flex: 1,

    paddingHorizontal: SPACING.xxl,
  },

  modalHeading: {
    fontSize: 16,
    fontWeight: '800',

    color: COLORS.textMain,

    marginTop: SPACING.xxl,
    marginBottom: SPACING.sm,
  },

  modalText: {
    fontSize: 14,
    lineHeight: 23,

    color: COLORS.textSub,
  },

  modalFooter: {
    padding: SPACING.xxl,

    backgroundColor: COLORS.surface,

    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});

export default RegisterScreen;