import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  COLORS,
  SIZES,
  SPACING,
  SHADOWS,
} from '../constants/theme';
import { useAuth } from '../context/AuthContext';

interface InputProps extends TextInputProps {
  label?: string;
  icon?: string | React.ReactNode;
  error?: string;
  isPassword?: boolean;
}

export const Input = ({
  label,
  icon,
  error,
  isPassword = false,
  style,
  onFocus,
  onBlur,
  ...props
}: InputProps) => {
  const { t } = useAuth();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleFocus = (event: any) => {
    setIsFocused(true);
    onFocus?.(event);
  };

  const handleBlur = (event: any) => {
    setIsFocused(false);
    onBlur?.(event);
  };

  return (
    <View style={[styles.container, style]}>

      {/* Label */}
      {label && (
        <Text style={styles.label}>
          {label}
        </Text>
      )}

      {/* Input */}
      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.focused,
          error && styles.errorBorder,
        ]}
      >

        {/* Left icon */}
        {icon && (
          <View style={styles.iconBox}>
            {typeof icon === 'string' ? (
              <Ionicons
                name={icon as any}
                size={20}
                color={
                  isFocused
                    ? COLORS.primary
                    : COLORS.textMuted
                }
              />
            ) : (
              icon
            )}
          </View>
        )}

        {/* Text field */}
        <TextInput
          {...props}
          style={styles.input}
          placeholderTextColor={COLORS.placeholder}
          secureTextEntry={
            isPassword && !showPassword
          }
          onFocus={handleFocus}
          onBlur={handleBlur}
        />

        {/* Password toggle */}
        {isPassword && (
          <TouchableOpacity
            onPress={() =>
              setShowPassword((previous) => !previous)
            }
            activeOpacity={0.7}
            style={styles.toggleBtn}
            hitSlop={{
              top: 8,
              bottom: 8,
              left: 8,
              right: 8,
            }}
            accessibilityRole="button"
            accessibilityLabel={
              showPassword
                ? t('a11y_hide_password')
                : t('a11y_show_password')
            }
          >
            <Ionicons
              name={
                showPassword
                  ? 'eye-off-outline'
                  : 'eye-outline'
              }
              size={20}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Error */}
      {error && (
        <View style={styles.errorRow}>
          <Ionicons
            name="alert-circle-outline"
            size={14}
            color={COLORS.danger}
          />

          <Text style={styles.errorText}>
            {error}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: SPACING.lg,
  },

  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMain,
    marginBottom: SPACING.sm,
    marginLeft: SPACING.xs,
    letterSpacing: 0.15,
  },

  inputWrapper: {
    minHeight: 54,

    flexDirection: 'row',
    alignItems: 'center',

    backgroundColor: COLORS.inputFill,

    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radiusMd,

    paddingHorizontal: SPACING.md,

    ...SHADOWS.light,
  },

  focused: {
    borderColor: COLORS.primary,
    borderWidth: 1.5,
    backgroundColor: COLORS.surface,
  },

  errorBorder: {
    borderColor: COLORS.danger,
  },

  iconBox: {
    width: 28,
    marginRight: SPACING.sm,

    alignItems: 'center',
    justifyContent: 'center',
  },

  input: {
    flex: 1,
    minHeight: 52,

    paddingVertical: 0,
    paddingHorizontal: 0,

    color: COLORS.textMain,
    fontSize: 15,
    fontWeight: '500',
  },

  toggleBtn: {
    width: 36,
    height: 36,

    marginLeft: SPACING.sm,

    alignItems: 'center',
    justifyContent: 'center',
  },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',

    marginTop: SPACING.xs,
    marginLeft: SPACING.xs,
  },

  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '500',
    marginLeft: SPACING.xs,
  },
});