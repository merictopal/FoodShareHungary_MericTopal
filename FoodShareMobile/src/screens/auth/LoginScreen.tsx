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
import { useAuth } from '../../context/AuthContext';
import { COLORS, SHADOWS } from '../../constants/theme';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';

const LoginScreen = ({ navigation }: any) => {
  // --- HOOKS & CONTEXT ---
  const { login, isLoading, t, changeLanguage, lang } = useAuth();
  
  // --- STATE MANAGEMENT ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // --- ACTIONS ---
  const handleLogin = async () => {
    // Prevent empty submissions
    if (!email || !password) return;

    try {
      await login(email, password);
    } catch (e) {
      // Errors are handled globally inside AuthContext
      console.log("Login failed.");
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        
        {/* --- HEADER SECTION --- */}
        <View style={styles.header}>
          
          {/* AI Generated Premium Logo */}
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
        <View style={styles.form}>
          <Input 
            label={t('email_ph')}
            placeholder={t('ph_email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          
          <Input 
            label={t('pass_ph')}
            placeholder={t('ph_password')}
            value={password}
            onChangeText={setPassword}
            isPassword
          />

          <View style={styles.buttonSpacing} />

          <Button 
            title={t('login_btn')}
            onPress={handleLogin}
            loading={isLoading}
          />

          {/* --- NAVIGATION FOOTER --- */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('no_acc')} </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')} activeOpacity={0.7}>
              <Text style={styles.link}>{t('register_btn').toUpperCase()}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* --- LANGUAGE SWITCHER (Minimalist Bottom Version) --- */}
        <View style={styles.langWrapper}>
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

      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// --- STYLES ---
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background 
  },
  scrollContent: { 
    flexGrow: 1, 
    justifyContent: 'center', 
    paddingHorizontal: 28,
    paddingVertical: 40
  },
  
  // Header & Logo Styles
  header: { 
    alignItems: 'center', 
    marginBottom: 40,
    marginTop: 20
  },
  logoContainer: {
    width: 96, 
    height: 96, 
    borderRadius: 24, // Modern App Icon Squircle
    backgroundColor: '#FFFFFF',
    alignItems: 'center', 
    justifyContent: 'center',
    marginBottom: 24, 
    borderWidth: 1, 
    borderColor: '#F0F0F0',
    ...SHADOWS.medium // Adds a beautiful soft shadow behind the white box
  },
  logoImage: {
    width: 64,
    height: 64,
    // Ensures the logo sits perfectly inside the box
  },
  title: { 
    fontSize: 28, 
    fontWeight: '900', 
    color: COLORS.textMain, 
    textAlign: 'center',
    letterSpacing: -0.5 
  },
  subtitle: { 
    fontSize: 15, 
    color: COLORS.textSub, 
    marginTop: 10, 
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 22
  },
  
  // Form Styles
  form: { 
    width: '100%' 
  },
  buttonSpacing: {
    height: 24
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
    fontWeight: '600' 
  },
  link: { 
    color: COLORS.primary, // Soft Coral
    fontWeight: '900', 
    fontSize: 14,
    letterSpacing: 0.5
  },
  
  // Minimalist Bottom Language Switcher
  langWrapper: {
    alignItems: 'center',
    marginTop: 50,
    marginBottom: 20
  },
  langContainer: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    backgroundColor: '#FFFFFF', // Clean white pill
    padding: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    ...SHADOWS.light
  },
  langBtn: { 
    paddingVertical: 8,
    paddingHorizontal: 16, 
    borderRadius: 10, 
  },
  langBtnActive: { 
    backgroundColor: COLORS.background, // Subtle indent effect
  },
  langText: { 
    fontSize: 13, 
    fontWeight: '800', 
    color: '#B0B0B0' // Soft inactive gray
  },
  langTextActive: { 
    color: COLORS.textMain 
  }
});

export default LoginScreen;