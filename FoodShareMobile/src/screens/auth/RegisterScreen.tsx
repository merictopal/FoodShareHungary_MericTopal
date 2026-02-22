import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ScrollView 
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SHADOWS } from '../../constants/theme';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Header } from '../../components/Header';

const RegisterScreen = ({ navigation }: any) => {
  // --- HOOKS & CONTEXT ---
  const { register, isLoading, t } = useAuth();
  
  // --- STATE MANAGEMENT ---
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'student' | 'restaurant'>('student');

  // --- ACTIONS ---
  const handleRegister = async () => {
    // Prevent empty submissions
    if (!name || !email || !password) return;

    try {
      await register({ name, email, password, role });
      navigation.navigate('Login');
    } catch (e) {
      // Error handled by AuthContext
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

        {/* --- ROLE SELECTOR (Gamified/Premium feel without emojis) --- */}
        <View style={styles.roleSelector}>
          <TouchableOpacity 
            style={[styles.roleBtn, role === 'student' && styles.roleBtnActive]} 
            onPress={() => setRole('student')}
            activeOpacity={0.7}
          >
            <Text style={[styles.roleText, role === 'student' && styles.roleTextActive]}>
              {t('role_student')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.roleBtn, role === 'restaurant' && styles.roleBtnActive]} 
            onPress={() => setRole('restaurant')}
            activeOpacity={0.7}
          >
            <Text style={[styles.roleText, role === 'restaurant' && styles.roleTextActive]}>
              {t('role_rest')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* --- REGISTRATION FORM --- */}
        <View style={styles.form}>
          
          {/* Dynamically switching label and placeholder based on selected role.
              Also removed emojis (🎓, 🍳) to maintain a sleek, clean UI. */}
          <Input 
            label={role === 'student' ? t('name_student_ph') : t('name_rest_ph')}
            placeholder={role === 'student' ? t('ph_name_student') : t('ph_offer_name')} 
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
    paddingTop: 10 // Adjusted to pull content slightly closer to the header
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
    backgroundColor: '#EAECEF', // Soft neutral background for the selector
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
    ...SHADOWS.light // Using our newly defined premium shadow
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