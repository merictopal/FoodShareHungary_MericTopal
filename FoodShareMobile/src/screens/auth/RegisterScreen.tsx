import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ScrollView, Alert 
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SHADOWS } from '../../constants/theme';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Header } from '../../components/Header';

const RegisterScreen = ({ navigation }: any) => {
  // --- HOOKS & CONTEXT ---
  // 🚀 NEW: We brought in the 'login' function to achieve Auto-Login!
  const { register, login, isLoading, t } = useAuth();
  
  // --- STATE MANAGEMENT ---
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // 🚀 NEW: Phone and Address fields
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  
  // 🚀 FIXED: UI says 'student' or 'restaurant', but we map 'student' -> 'user' in backend
  const [displayRole, setDisplayRole] = useState<'student' | 'restaurant'>('student');

  // --- ACTIONS ---
  const validateEmail = (emailStr: string) => {
    // Standard Regex to check if email contains @ and .
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(emailStr);
  };

  const handleRegister = async () => {
    // 1. Prevent empty core submissions
    if (!name || !email || !password) {
      Alert.alert(t('error') || "Error", t('fill_all_fields') || "Please fill in all required fields.");
      return;
    }

    // 2. Strong Email Validation
    if (!validateEmail(email)) {
      Alert.alert(t('error') || "Error", t('invalid_email') || "Please enter a valid email address.");
      return;
    }

    // 3. Prevent empty address for restaurants
    if (displayRole === 'restaurant' && !address) {
      Alert.alert(t('error') || "Error", "Restaurant address is required.");
      return;
    }

    try {
      // 🚀 FIXED: Map 'student' UI selection to 'user' database role
      const backendRole = displayRole === 'student' ? 'user' : 'restaurant';
      
      // Send the new data to backend
      await register({ 
        name, 
        email, 
        password, 
        role: backendRole,
        phone,
        address: displayRole === 'restaurant' ? address : undefined
      });
      
      // 🚀 THE MAGIC: Auto-Login after successful registration! (Frictionless UX)
      await login(email, password);
      
      // Note: We don't need to navigation.navigate('Home') because AuthContext 
      // automatically switches the Stack to MainStack when a user is detected!

    } catch (e: any) {
      // If error is not handled completely inside AuthContext, show it here
      const msg = e.response?.data?.message || "Registration failed. Please try again.";
      Alert.alert(t('error') || "Error", msg);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={styles.container}
    >
      <Header title={t('register_title')} onBack={() => navigation.goBack()} />
      
      <ScrollView 
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sub}>{t('register_sub')}</Text>

        {/* --- ROLE SELECTOR --- */}
        <View style={styles.roleSelector}>
          <TouchableOpacity 
            style={[styles.roleBtn, displayRole === 'student' && styles.roleBtnActive]} 
            onPress={() => setDisplayRole('student')}
            activeOpacity={0.7}
          >
            <Text style={[styles.roleText, displayRole === 'student' && styles.roleTextActive]}>
              {t('role_student')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.roleBtn, displayRole === 'restaurant' && styles.roleBtnActive]} 
            onPress={() => setDisplayRole('restaurant')}
            activeOpacity={0.7}
          >
            <Text style={[styles.roleText, displayRole === 'restaurant' && styles.roleTextActive]}>
              {t('role_rest')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* --- REGISTRATION FORM --- */}
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

          {/* 🚀 NEW: Phone Number (For both User and Restaurant) */}
          <Input 
            label={t('phone_ph') || "Phone Number"} 
            placeholder="+36 30 123 4567" 
            value={phone} 
            onChangeText={setPhone} 
            keyboardType="phone-pad" 
          />

          {/* 🚀 NEW: Address (Only visible if Restaurant is selected) */}
          {displayRole === 'restaurant' && (
             <Input 
               label={t('address_ph') || "Restaurant Address"} 
               placeholder="1051 Budapest, Szent István tér" 
               value={address} 
               onChangeText={setAddress} 
               autoCapitalize="words"
             />
          )}
          
          <Input 
            label={t('pass_ph')} 
            placeholder={t('ph_password')} 
            value={password} 
            onChangeText={setPassword} 
            isPassword 
          />

          <View style={styles.buttonSpacing} />
          
          <Button 
            title={t('register_btn')} 
            onPress={handleRegister} 
            loading={isLoading} 
            variant="primary" 
          />
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
  content: { 
    padding: 24,
    paddingTop: 10,
    paddingBottom: 40 // Added padding bottom so the scrollview doesn't hide the button under keyboard
  },
  sub: { 
    fontSize: 15, 
    color: COLORS.textSub, 
    marginBottom: 30, 
    textAlign: 'center',
    fontWeight: '500'
  },
  
  // Role Selector Styles
  roleSelector: { 
    flexDirection: 'row', 
    backgroundColor: '#EAECEF', 
    borderRadius: 14, 
    padding: 4, 
    marginBottom: 30 
  },
  roleBtn: { 
    flex: 1, 
    paddingVertical: 12, 
    alignItems: 'center', 
    borderRadius: 10 
  },
  roleBtnActive: { 
    backgroundColor: COLORS.surface, 
    ...SHADOWS.light 
  },
  roleText: { 
    fontWeight: '700', 
    color: COLORS.textSub,
    fontSize: 13,
    letterSpacing: 0.5
  },
  roleTextActive: { 
    color: COLORS.primary, 
    fontWeight: '900' 
  },
  
  form: { 
    width: '100%' 
  },
  buttonSpacing: {
    height: 30
  }
});

export default RegisterScreen;