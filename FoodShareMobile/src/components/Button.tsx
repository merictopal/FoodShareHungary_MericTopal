import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: string; 
}

export const Button = ({ 
  title, 
  onPress, 
  variant = 'primary', 
  loading = false, 
  disabled = false,
  style,
  textStyle,
  icon
}: ButtonProps) => {
  
  // Define background color based on variant
  const getBgColor = () => {
    if (disabled) return COLORS.border;
    switch (variant) {
      case 'primary': return COLORS.primary;
      case 'secondary': return COLORS.secondary;
      case 'danger': return COLORS.danger;
      case 'outline': return 'transparent';
      case 'ghost': return 'transparent';
      default: return COLORS.primary;
    }
  };

  // Define text color based on variant
  const getTextColor = () => {
    if (disabled) return COLORS.textSub;
    switch (variant) {
      case 'outline': return COLORS.textMain; // Outline texts are usually dark for social logins
      case 'ghost': return COLORS.textSub;
      default: return COLORS.white;
    }
  };

  // Define border styles for outline buttons
  const getBorder = () => {
    if (variant === 'outline') return { borderWidth: 1.5, borderColor: COLORS.border };
    return {};
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.container,
        { backgroundColor: getBgColor() },
        getBorder(),
        (variant === 'primary' || variant === 'secondary') && !disabled ? SHADOWS.medium : {},
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? COLORS.primary : '#FFF'} />
      ) : (
        <>
          {icon && <Text style={[styles.icon, { color: getTextColor() }]}>{icon}</Text>}
          <Text style={[styles.text, { color: getTextColor() }, textStyle]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

// --- STYLES ---
const styles = StyleSheet.create({
  container: {
    height: 56,
    borderRadius: SIZES.radius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginBottom: 12, // Slight increase for better spacing between stacked buttons
  },
  text: {
    fontSize: SIZES.medium,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  icon: {
    fontSize: 18,
    marginRight: 10,
  }
});