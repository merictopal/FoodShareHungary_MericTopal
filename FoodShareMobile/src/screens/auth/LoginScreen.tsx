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
  Image 
} from 'react-native';

// --- CUSTOM HOOKS & COMPONENTS ---
// Importing the custom authentication context and predefined UI elements (colors, shadows, buttons)
import { useAuth } from '../../context/AuthContext';
import { COLORS, SIZES, SHADOWS } from '../../constants/theme';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';

// --- GOOGLE SIGN-IN IMPORTS ---
// Importing both the main GoogleSignin object for logic and the official GoogleSigninButton for the UI
import { GoogleSignin, GoogleSigninButton } from '@react-native-google-signin/google-signin';

const LoginScreen = ({ navigation }: any) => {
  // --- HOOKS & GLOBAL CONTEXT ---
  // Destructuring all necessary variables and functions from the authentication context
  const { login, loginWithGoogle, isLoading, t, changeLanguage, lang } = useAuth();
  
  // --- STATE MANAGEMENT ---
  // Local state to hold the user's input for traditional email/password authentication
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // --- ACTIONS ---

  /**
   * Handles the standard email and password login flow.
   * Prevents submission if fields are empty and relies on the AuthContext for error handling.
   */
  const handleLogin = async () => {
    if (!email || !password) return;

    try {
      await login(email, password);
    } catch (e) {
      // Errors (like invalid credentials) are handled globally inside the AuthContext
      console.log("Standard login failed.");
    }
  };

  /**
   * Handles the Google OAuth Sign-In flow.
   * Ensures Google Play Services are available, opens the native Google consent modal,
   * retrieves the token, and sends it securely to our backend.
   */
  const handleGoogleLogin = async () => {
    try {
      // 1. Verify that the Android device has Google Play Services installed and updated
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      
      // 2. Open the native Google UI popup and retrieve the user's authentication details
      const userInfo = await GoogleSignin.signIn();
      
      // Extract the ID token. Note: The structure depends slightly on the library version
      const idToken = userInfo?.data?.idToken || userInfo?.idToken;
      
      if (idToken) {
        // 3. Send the secure ID token to our Python backend via the AuthContext
        await loginWithGoogle(idToken);
      } else {
        throw new Error("No ID token received from Google payload");
      }
    } catch (error: any) {
      // If the user manually closes the Google popup, it throws an error. We silently log it.
      console.log("Google Sign-In Error or User Cancelled the flow:", error);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      {/* Configure the status bar for a clean look across the application */}
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        
        {/* --- TOP BAR (Language Switcher) --- */}
        {/* Allows the user to dynamically switch the application language on the fly */}
        <View style={styles.topBar}>
          <View style={styles.langContainer}>
            {['tr', 'en', 'hu'].map((l) => (
              <TouchableOpacity 
                key={l} 
                onPress={() => changeLanguage(l)} 
                style={[styles.langBtn, lang === l && styles.langBtnActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.langText, lang === l && styles.langTextActive]}>
                  {l.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* --- HEADER SECTION --- */}
        {/* Displays the circular application logo alongside the translated titles */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../assets/images/logo.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          
          <Text style={styles.title}>{t('login_title')}</Text>
          <Text style={styles.subtitle}>{t('login_sub')}</Text>
        </View>

        {/* --- FORM SECTION --- */}
        {/* Contains the primary inputs for email and password authentication */}
        <View style={styles.form}>
          <Input 
            label={t('email_ph')}
            placeholder="example@student.hu" // Real-world placeholder example
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          
          <Input 
            label={t('pass_ph')}
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            isPassword
          />

          {/* --- FORGOT PASSWORD LINK --- */}
          {/* Navigates the user to the dedicated password reset screen */}
          <View style={styles.forgotPasswordContainer}>
            <TouchableOpacity 
              activeOpacity={0.7} 
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={styles.forgotPasswordText}>
                {t('forgot_pass')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonSpacing} />

          {/* --- MAIN LOGIN ACTION --- */}
          {/* Triggers the standard email/password authentication process */}
          <Button 
            title={t('login_btn')}
            onPress={handleLogin}
            loading={isLoading}
            variant="primary"
          />

          {/* --- SOCIAL LOGIN DIVIDER --- */}
          {/* Visual separator before displaying third-party authentication options */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* --- OFFICIAL GOOGLE SIGN-IN BUTTON --- */}
          {/* Replaces the custom button with the official SDK button to ensure brand compliance and standard UX */}
          <View style={styles.googleButtonWrapper}>
            <GoogleSigninButton
              size={GoogleSigninButton.Size.Wide}
              color={GoogleSigninButton.Color.Light} // Switch to .Dark if you implement a dark theme later
              onPress={handleGoogleLogin}
              disabled={isLoading}
              style={styles.googleButton}
            />
          </View>

          {/* --- NAVIGATION FOOTER --- */}
          {/* Directs new users to the account creation screen */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('no_acc')} </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')} activeOpacity={0.7}>
              <Text style={styles.link}>{t('register_btn').toUpperCase()}</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// --- STYLESHEET ---
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background 
  },
  scrollContent: { 
    flexGrow: 1, 
    paddingHorizontal: 28,
    paddingBottom: 40
  },
  
  // Top Bar & Language Switcher Styles
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Platform.OS === 'android' ? StatusBar.currentHeight! + 10 : 50,
    marginBottom: 10,
  },
  langContainer: { 
    flexDirection: 'row', 
    backgroundColor: COLORS.surface, 
    padding: 4,
    borderRadius: SIZES.radiusFull,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.light
  },
  langBtn: { 
    paddingVertical: 6,
    paddingHorizontal: 12, 
    borderRadius: SIZES.radiusFull, 
  },
  langBtnActive: { 
    backgroundColor: COLORS.background, 
  },
  langText: { 
    fontSize: 12, 
    fontWeight: '800', 
    color: COLORS.placeholder 
  },
  langTextActive: { 
    color: COLORS.textMain 
  },

  // Header & Logo Alignment Styles
  header: { 
    alignItems: 'center', 
    marginBottom: 32, 
  },
  logoContainer: {
    width: 80, 
    height: 80, 
    borderRadius: SIZES.radiusFull, 
    backgroundColor: COLORS.surface,
    alignItems: 'center', 
    justifyContent: 'center',
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: COLORS.border,
    ...SHADOWS.light 
  },
  logoImage: {
    width: 50,
    height: 50,
  },
  title: { 
    fontSize: 26, 
    fontWeight: '500', 
    color: COLORS.textMain, 
    textAlign: 'center',
    letterSpacing: -0.5 
  },
  subtitle: { 
    fontSize: 15, 
    color: COLORS.textMain, 
    marginTop: 6, 
    textAlign: 'center',
    fontWeight: '400',
    lineHeight: 22
  },
  
  // Form Layout Styles
  form: { 
    width: '100%' 
  },
  
  // Forgot Password Link Adjustments
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginTop: -10, 
    marginBottom: 10,
  },
  forgotPasswordText: {
    color: COLORS.textSub,
    fontSize: 13,
    fontWeight: '600',
  },

  buttonSpacing: {
    height: 16
  },
  
  // Social Login Divider Elements
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    marginHorizontal: 16,
    color: COLORS.placeholder,
    fontSize: 12,
    fontWeight: '700',
  },

  // Official Google Button Container Styles
  googleButtonWrapper: {
    alignItems: 'center',
    width: '100%',
  },
  googleButton: {
    width: '100%',
    height: 52, // Standard height mapped to match existing UI input dimensions
  },

  // Footer Link Styles
  footer: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    marginTop: 32,
    alignItems: 'center'
  },
  footerText: { 
    color: COLORS.textSub, 
    fontSize: 14,
    fontWeight: '500' 
  },
  link: { 
    color: COLORS.success, 
    fontWeight: '800', 
    fontSize: 14,
    letterSpacing: 0.5,
    textDecorationLine: 'underline', 
  },
});

export default LoginScreen;