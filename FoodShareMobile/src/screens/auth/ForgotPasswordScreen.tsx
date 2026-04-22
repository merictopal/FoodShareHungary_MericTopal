import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView 
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { client } from '../../api/client';
import { COLORS } from '../../constants/theme';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Header } from '../../components/Header';

const ForgotPasswordScreen = ({ navigation }: any) => {
  // --- HOOKS ---
  const { t } = useAuth();
  
  // --- STATE MANAGEMENT ---
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // --- ACTIONS ---
  /**
   * Handles the password reset request by sending the email to the backend API.
   * If successful, it shows a success alert and navigates back to the login screen.
   */
  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert(t('error') || "Error", t('invalid_email') || "Please enter your email.");
      return;
    }

    setIsLoading(true);
    try {
      // API call to our Python backend to trigger the actual email sending process
      const response = await client.post('/auth/forgot-password', { email });
      
      if (response.data.success) {
        Alert.alert("Success", t('reset_sent_success'), [
          { text: "OK", onPress: () => navigation.goBack() }
        ]);
      }
    } catch (error: any) {
      // Capture and display any errors returned by the backend (e.g., User not found)
      const msg = error.response?.data?.message || "Something went wrong. Please try again.";
      Alert.alert(t('error') || "Error", msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={styles.container}
    >
      {/* Top Navigation Header */}
      <Header title="" onBack={() => navigation.goBack()} />
      
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('forgot_title')}</Text>
        <Text style={styles.sub}>{t('forgot_sub')}</Text>

        <View style={styles.form}>
          <Input 
            label={t('email_ph')} 
            placeholder="example@student.hu" 
            value={email} 
            onChangeText={setEmail} 
            keyboardType="email-address" 
            autoCapitalize="none"
          />

          <View style={styles.buttonSpacing} />

          <Button 
            title={t('send_reset_btn')} 
            onPress={handleResetPassword} 
            loading={isLoading} 
            variant="primary" 
          />
          
          <Button 
            title={t('back_to_login')} 
            onPress={() => navigation.goBack()} 
            variant="outline" 
            style={{ marginTop: 12 }}
          />
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
  content: { 
    padding: 24, 
    alignItems: 'center',
    paddingTop: 40
  },
  title: { 
    fontSize: 28, 
    fontWeight: '700', 
    color: COLORS.textMain, 
    marginBottom: 12,
    textAlign: 'center'
  },
  sub: { 
    fontSize: 15, 
    color: COLORS.textSub, 
    marginBottom: 40, 
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20
  },
  form: { 
    width: '100%' 
  },
  buttonSpacing: {
    height: 20
  }
});

export default ForgotPasswordScreen;