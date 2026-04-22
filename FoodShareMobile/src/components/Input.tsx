import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  TextInputProps, 
  TouchableOpacity 
} from 'react-native';
import { COLORS, SIZES } from '../constants/theme';

// --- INTERFACES ---
interface InputProps extends TextInputProps {
  label?: string;
  icon?: string | React.ReactNode; 
  error?: string;
  isPassword?: boolean;
}

export const Input = ({ label, icon, error, isPassword, style, ...props }: InputProps) => {
  // --- STATE ---
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={[styles.container, style]}>
      
      {/* --- LABEL --- */}
      {label && <Text style={styles.label}>{label}</Text>}
      
      {/* --- INPUT WRAPPER --- */}
      <View style={[
        styles.inputWrapper,
        isFocused && styles.focused,
        error ? styles.errorBorder : null
      ]}>
        
        {/* --- OPTIONAL ICON --- */}
        {icon && (
          <View style={styles.iconBox}>
            {typeof icon === 'string' ? (
              <Text style={styles.iconText}>{icon}</Text>
            ) : (
              icon
            )}
          </View>
        )}
        
        {/* --- TEXT FIELD --- */}
        <TextInput
          style={styles.input}
          placeholderTextColor={COLORS.placeholder}
          secureTextEntry={isPassword && !showPassword}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />

        {/* --- PASSWORD TOGGLE (Clean Typography) --- */}
        {isPassword && (
          <TouchableOpacity 
            onPress={() => setShowPassword(!showPassword)}
            activeOpacity={0.7}
            style={styles.toggleBtn}
          >
            <Text style={styles.toggleText}>
              {showPassword ? 'Hide' : 'Show'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* --- ERROR MESSAGE --- */}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

// --- STYLES ---
const styles = StyleSheet.create({
  container: { 
    marginBottom: 20 
  },
  label: {
    fontSize: 13, // Slightly larger for sentence case
    fontWeight: '700',
    color: COLORS.textSub,
    marginBottom: 8,
    marginLeft: 4,
    // Removed uppercase transformation based on UX feedback
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputFill, 
    borderRadius: SIZES.radius, // 10px for slightly sharper, structured look
    height: 56,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border, // Visible border added
  },
  focused: {
    borderColor: COLORS.primary, // Highlights with Terra Cotta on focus
    backgroundColor: '#FFFFFF',
  },
  errorBorder: {
    borderColor: COLORS.danger
  },
  iconBox: { 
    marginRight: 12, 
    justifyContent: 'center',
    alignItems: 'center'
  },
  iconText: {
    fontSize: 16,
    color: COLORS.textSub,
    fontWeight: 'bold'
  },
  input: { 
    flex: 1, 
    color: COLORS.textMain, 
    fontSize: 15,
    fontWeight: '500',
    height: '100%', 
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0', 
    borderRadius: SIZES.radiusSm,
    marginLeft: 10
  },
  toggleText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSub,
  },
  errorText: { 
    color: COLORS.danger, 
    fontSize: 12, 
    marginTop: 6, 
    marginLeft: 4,
    fontWeight: '600' 
  }
});