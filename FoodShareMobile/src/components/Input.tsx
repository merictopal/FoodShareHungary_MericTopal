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
  icon?: string | React.ReactNode; // Flexible: Can accept standard text or actual Icon components later
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
          placeholderTextColor={COLORS.textSub || '#A0A0A0'}
          secureTextEntry={isPassword && !showPassword}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />

        {/* --- PASSWORD TOGGLE (Clean Typography instead of Emojis) --- */}
        {isPassword && (
          <TouchableOpacity 
            onPress={() => setShowPassword(!showPassword)}
            activeOpacity={0.7}
            style={styles.toggleBtn}
          >
            <Text style={styles.toggleText}>
              {showPassword ? 'HIDE' : 'SHOW'}
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
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSub,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5 // Adds a premium look to small uppercase text
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA', // Clean, slightly off-white background
    borderRadius: 12, // Modern, smooth corners
    height: 56,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#EEEEEE',
  },
  focused: {
    borderColor: COLORS.primary,
    backgroundColor: '#FFFFFF', // Pops out when focused
  },
  errorBorder: {
    borderColor: '#FF3B30' // Standard red error color
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
    height: '100%', // Ensures the tap target area is large enough
  },
  
  // Premium Typographic Toggle Button
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0', // Subtle button background
    borderRadius: 6,
    marginLeft: 10
  },
  toggleText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.textSub,
    letterSpacing: 0.5
  },
  
  errorText: { 
    color: '#FF3B30', 
    fontSize: 12, 
    marginTop: 6, 
    marginLeft: 4,
    fontWeight: '600' 
  }
});