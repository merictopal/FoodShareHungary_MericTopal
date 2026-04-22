import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ScrollView, Alert, Modal, SafeAreaView
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/theme'; 
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Header } from '../../components/Header';

const RegisterScreen = ({ navigation }: any) => {
  // --- HOOKS & GLOBAL CONTEXT ---
  // Extracting the necessary authentication functions and translation hook from our custom context.
  const { register, login, isLoading, t } = useAuth();
  
  // --- CORE STATE MANAGEMENT ---
  // These states handle the primary credentials and information required for all user types.
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); 
  
  // --- DEMOGRAPHIC & CONTACT STATE ---
  const [dob, setDob] = useState(''); // Date of Birth formatted as DD/MM/YYYY
  const [phone, setPhone] = useState(''); 
  const [address, setAddress] = useState('');
  
  // --- LEGAL & UI CONTROL STATE ---
  const [agreedToTerms, setAgreedToTerms] = useState(false); 
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [displayRole, setDisplayRole] = useState<'student' | 'restaurant'>('student');

  // --- EXTENDED DEMOGRAPHIC STATE (NEW FIELDS) ---
  // These fields collect optional data to build a comprehensive user profile.
  const [gender, setGender] = useState(''); // Stores the underlying ID ('Male', 'Female', etc.)
  const [occupation, setOccupation] = useState(''); 
  const [university, setUniversity] = useState('');
  const [major, setMajor] = useState('');
  const [studyYear, setStudyYear] = useState(''); 

  // --- DATA MAPPING FOR TRANSLATED ARRAYS ---
  // We use an array of objects for gender so we can display the translated text to the user
  // but keep the consistent English ID in the state to send to the backend database.
  const genderOptions = [
    { id: 'Male', label: t('gender_male') },
    { id: 'Female', label: t('gender_female') },
    { id: 'Prefer not to say', label: t('gender_prefer_not') }
  ];

  // --- ACTIONS & VALIDATIONS ---
  
  /**
   * Validates the email format using a standard Regular Expression.
   * Ensures that the user provides a string containing an '@' and a domain.
   */
  const validateEmail = (emailStr: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(emailStr);
  };

  /**
   * Validates the age of the user based on the DD/MM/YYYY string.
   * The business logic requires users to be at least 18 years old.
   * Assuming the current operational year is 2026, the user must be born in 2008 or earlier.
   */
  const validateAge = (dobStr: string) => {
    const parts = dobStr.split('/');
    if (parts.length !== 3) return false;
    
    const year = parseInt(parts[2], 10);
    if (2026 - year < 18) return false;
    
    return true;
  };

  /**
   * Automatically formats the Date of Birth input field as the user types.
   * It strips non-numeric characters and injects slashes at the correct positions (DD/MM/YYYY).
   * It also handles backspace events cleanly without trapping the cursor.
   */
  const handleDobChange = (text: string) => {
    // Allow the user to delete characters normally (Backspace handling)
    if (text.length < dob.length) {
      setDob(text);
      return;
    }

    // Remove any non-numeric characters from the raw input string
    let cleaned = text.replace(/\D/g, '');
    let formatted = cleaned;

    // Auto-append slashes immediately when the day or month block is completed
    if (cleaned.length >= 5) {
      // Format as DD/MM/YYYY
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
    } else if (cleaned.length === 4) {
      // Instantly add slash after MM
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/`;
    } else if (cleaned.length >= 3) {
      // Format as DD/MM...
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    } else if (cleaned.length === 2) {  
      // Instantly add slash after DD
      formatted = `${cleaned}/`;
    }

    setDob(formatted);
  };

  /**
   * The main registration execution function.
   * It runs through a series of strict validation gates before packaging the state payload
   * and transmitting it to the backend via the AuthContext register function.
   */
  const handleRegister = async () => {
    // 1. Prevent empty core submissions
    if (!name || !email || !password || !confirmPassword || !dob) {
      Alert.alert(t('error') || "Error", t('fill_all_fields') || "Please fill in all required fields.");
      return;
    }

    // 2. Strong Email Format Validation
    if (!validateEmail(email)) {
      Alert.alert(t('error') || "Error", t('invalid_email') || "Please enter a valid email address.");
      return;
    }

    // 3. Password Match Validation Check
    if (password !== confirmPassword) {
      Alert.alert(t('error') || "Error", "Passwords do not match. Please try again.");
      return;
    }

    // 4. Age Restriction Check (Must be 18+)
    if (!validateAge(dob)) {
      Alert.alert(t('error') || "Age Restriction", "You must be at least 18 years old to register.");
      return;
    }

    // 5. Terms and Conditions (GDPR Compliance Check)
    if (!agreedToTerms) {
      Alert.alert(t('error') || "Terms Required", "You must agree to the Terms of Service and Privacy Policy (GDPR) to continue.");
      return;
    }

    // 6. Prevent empty address submissions for restaurant accounts
    if (displayRole === 'restaurant' && !address) {
      Alert.alert(t('error') || "Error", "Restaurant address is required.");
      return;
    }

    try {
      // Map the UI role selection to the corresponding backend database role schema
      const backendRole = displayRole === 'student' ? 'user' : 'restaurant';
      
      // Sending all collected demographic and credential data to the backend API
      await register({ 
        name, 
        email, 
        password, 
        role: backendRole,
        phone, 
        date_of_birth: dob, 
        address: displayRole === 'restaurant' ? address : undefined,
        gender,
        occupation: displayRole === 'student' ? occupation : undefined, // Ensures occupation is not sent for restaurants
        university: displayRole === 'student' ? university : undefined,
        major: displayRole === 'student' ? major : undefined,
        study_year: displayRole === 'student' ? studyYear : undefined
      });
      
      // Automatically log the user into the application immediately after successful registration
      await login(email, password);

    } catch (e: any) {
      // Extract the error message provided by the backend, or fallback to a generic message
      const msg = e.response?.data?.message || "Registration failed. Please try again.";
      Alert.alert(t('error') || "Error", msg);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={styles.container}
    >
      {/* Top Navigation Header */}
      <Header title={t('register_title')} onBack={() => navigation.goBack()} />
      
      <ScrollView 
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sub}>{t('register_sub')}</Text>

        {/* --- PREMIUM ROLE SELECTOR (Underline Indicator Style) --- */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabBtn, displayRole === 'student' && styles.tabBtnActive]} 
            onPress={() => setDisplayRole('student')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, displayRole === 'student' && styles.tabTextActive]}>
              {t('role_student')}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tabBtn, displayRole === 'restaurant' && styles.tabBtnActive]} 
            onPress={() => setDisplayRole('restaurant')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, displayRole === 'restaurant' && styles.tabTextActive]}>
              {t('role_rest')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* --- REGISTRATION FORM FIELDS --- */}
        <View style={styles.form}>
          
          <Input 
            label={displayRole === 'student' ? t('name_student_ph') : t('name_rest_ph')}
            placeholder={displayRole === 'student' ? t('ph_name_student') : t('ph_offer_name')} 
            value={name} 
            onChangeText={setName} 
            autoCapitalize="words"
          />
          
          <Input 
            label={t('email_ph')} 
            placeholder={t('ph_email')} 
            value={email} 
            onChangeText={setEmail} 
            keyboardType="email-address" 
            autoCapitalize="none"
          />

          {/* Date of Birth Field utilizing the custom auto-formatting logic and translated dictionary keys */}
          <Input 
            label={t('dob')} 
            placeholder={t('dob_ph')} 
            value={dob} 
            onChangeText={handleDobChange} 
            keyboardType="numeric" 
            maxLength={10}
          />

          {/* --- GENDER SELECTION (CHIP COMPONENT STYLE) --- */}
          {/* Translates the label and iterates over the mapped genderOptions array for localization */}
          <Text style={styles.inputLabel}>{t('gender_optional')}</Text>
          <View style={styles.chipRow}>
            {genderOptions.map((item) => (
              <TouchableOpacity 
                key={item.id} 
                style={[styles.chip, gender === item.id && styles.chipActive]}
                onPress={() => setGender(item.id)}
              >
                <Text style={[styles.chipText, gender === item.id && styles.chipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Optional Phone Field (Available to both roles) */}
          <Input 
            label={t('phone_optional')} 
            placeholder="+36 30 123 4567" 
            value={phone} 
            onChangeText={setPhone} 
            keyboardType="phone-pad" 
          />

          {/* --- STUDENT SPECIFIC CONDITIONAL FIELDS --- */}
          {displayRole === 'student' && (
            <>
              {/* Occupation moved here, restricted to Student role only */}
              <Input 
                label={t('occupation_optional')} 
                placeholder="e.g. Graphic Designer, Freelancer" 
                value={occupation} 
                onChangeText={setOccupation} 
                autoCapitalize="words"
              />

              <Input 
                label={t('uni_optional')} 
                placeholder="e.g. BME, ELTE, Corvinus" 
                value={university} 
                onChangeText={setUniversity} 
                autoCapitalize="words"
              />
              
              <Input 
                label={t('major_optional')} 
                placeholder="e.g. Computer Science" 
                value={major} 
                onChangeText={setMajor} 
                autoCapitalize="words"
              />

              <Text style={styles.inputLabel}>{t('study_year_optional')}</Text>
              <View style={styles.chipRow}>
                {['1st', '2nd', '3rd', '4th', '5+'].map((item) => (
                  <TouchableOpacity 
                    key={item} 
                    style={[styles.chip, studyYear === item && styles.chipActive]}
                    onPress={() => setStudyYear(item)}
                  >
                    <Text style={[styles.chipText, studyYear === item && styles.chipTextActive]}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Address field is conditionally rendered exclusively for Restaurant accounts */}
          {displayRole === 'restaurant' && (
             <Input 
               label={t('address_ph') || "Restaurant Address"} 
               placeholder="1051 Budapest, Szent István tér" 
               value={address} 
               onChangeText={setAddress} 
               autoCapitalize="words"
             />
          )}
          
          {/* Security & Credential Inputs using strict translated labels */}
          <Input 
            label={t('secure_pass')} 
            placeholder={t('ph_password')} 
            value={password} 
            onChangeText={setPassword} 
            isPassword 
          />

          <Input 
            label={t('confirm_pass')} 
            placeholder={t('confirm_pass_ph')} 
            value={confirmPassword} 
            onChangeText={setConfirmPassword} 
            isPassword 
          />

          {/* --- TERMS & CONDITIONS (GDPR) CHECKBOX AREA --- */}
          <View style={styles.checkboxContainer}>
            <TouchableOpacity 
              style={[styles.checkbox, agreedToTerms && styles.checkboxActive]} 
              onPress={() => setAgreedToTerms(!agreedToTerms)}
              activeOpacity={0.8}
            >
              {agreedToTerms && <Text style={styles.checkIcon}>✓</Text>}
            </TouchableOpacity>
            <Text style={styles.termsText}>
              I agree to the{' '} 
              <Text style={styles.termsLink} onPress={() => setShowTermsModal(true)}>
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text style={styles.termsLink} onPress={() => setShowTermsModal(true)}>
                Privacy Policy (GDPR)
              </Text>.
            </Text>
          </View>

          <View style={styles.buttonSpacing} />
          
          <Button 
            title={t('register_btn')} 
            onPress={handleRegister} 
            loading={isLoading} 
            variant="primary" 
          />
        </View>
      </ScrollView>

      {/* --- PRIVACY POLICY & LEGAL TERMS MODAL COMPONENT --- */}
      {/* This modal presents the strict GDPR compliant text required for legal operation in the EU. */}
      <Modal
        visible={showTermsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTermsModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Legal & Privacy</Text>
            <TouchableOpacity onPress={() => setShowTermsModal(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody}>
            <Text style={styles.modalHeading}>1. Terms of Service</Text>
            <Text style={styles.modalText}>
              Welcome to FoodShare. By registering for an account, you agree to use our platform responsibly. 
              FoodShare aims to reduce food waste by connecting students and locals with restaurants offering 
              surplus food. You agree not to misuse the claim system or distribute fake QR codes.
            </Text>

            <Text style={styles.modalHeading}>2. Privacy Policy (GDPR Compliance)</Text>
            <Text style={styles.modalText}>
              Your privacy is critically important to us. Under the General Data Protection Regulation (GDPR):
              {"\n\n"}• We collect your data (Name, Email, Demographic details) solely to provide and improve the FoodShare service.
              {"\n"}• Your location data is only used locally on your device to show nearby offers and is not stored permanently.
              {"\n"}• We do not sell your personal data to third parties.
              {"\n"}• You have the right to request deletion of your account and all associated data at any time via your Profile settings.
            </Text>

            <Text style={styles.modalHeading}>3. Verification & Documents</Text>
            <Text style={styles.modalText}>
              If you upload a Student ID or other verification documents, they are stored securely on our AWS S3 servers 
              and are only reviewed by our admin team to grant you "Verified" status. They are not shared publicly.
            </Text>
          </ScrollView>
          <View style={styles.modalFooter}>
            <Button 
              title="I Understand & Accept" 
              onPress={() => {
                setAgreedToTerms(true);
                setShowTermsModal(false);
              }} 
            />
          </View>
        </SafeAreaView>
      </Modal>

    </KeyboardAvoidingView>
  );
};

// --- STYLESHEET ---
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background 
  },
  content: { 
    padding: 24,
    paddingTop: 10,
    paddingBottom: 40 
  },
  sub: { 
    fontSize: 15, 
    color: COLORS.textSub, 
    marginBottom: 30, 
    textAlign: 'center',
    fontWeight: '400',
    lineHeight: 22
  },
  
  // Premium Tab Styles (Underline instead of blocky toggle)
  tabContainer: { 
    flexDirection: 'row', 
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 30 
  },
  tabBtn: { 
    flex: 1, 
    paddingVertical: 14, 
    alignItems: 'center', 
  },
  tabBtnActive: { 
    borderBottomWidth: 3,
    borderBottomColor: COLORS.primary, // Brand highlight color
  },
  tabText: { 
    fontWeight: '600', 
    color: COLORS.placeholder,
    fontSize: 14,
    letterSpacing: 0.5
  },
  tabTextActive: { 
    color: COLORS.primary, 
    fontWeight: '800' 
  },
  
  form: { 
    width: '100%' 
  },

  // Input Label & Dynamic Chip Component Styles
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMain,
    marginBottom: 8,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSub,
  },
  chipTextActive: {
    color: COLORS.white,
  },

  // Legal Checkbox Form Styles
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start', // Aligned to the top to accommodate potential text wrapping
    marginTop: 10,
    marginBottom: 20,
    paddingRight: 20, 
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 6,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginTop: 2 // Slight vertical shift to perfectly align with the text baseline
  },
  checkboxActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  checkIcon: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  termsText: {
    fontSize: 13,
    color: COLORS.textSub,
    lineHeight: 20,
    flex: 1,
  },
  termsLink: {
    color: COLORS.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  buttonSpacing: {
    height: 10
  },

  // Legal Modal Overlay Styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textMain
  },
  closeBtn: {
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textSub
  },
  modalBody: {
    flex: 1,
    padding: 24,
  },
  modalHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 10,
    marginTop: 20,
  },
  modalText: {
    fontSize: 14,
    color: COLORS.textSub,
    lineHeight: 24,
  },
  modalFooter: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  }
});

export default RegisterScreen;