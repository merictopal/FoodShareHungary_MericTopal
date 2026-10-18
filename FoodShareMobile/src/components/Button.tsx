import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { COLORS, SIZES, SHADOWS, SPACING } from '../constants/theme';

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'success'
  | 'dangerSoft';

// 'sm' is the compact in-card size (claim buttons); 'md' is the default full-size button
type ButtonSize = 'sm' | 'md';

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'md',
  style,
  textStyle,
  icon,
}) => {
  const isDisabled = disabled || loading;

  const getBackgroundColor = () => {
    switch (variant) {
      case 'secondary':
        return COLORS.secondary;
      case 'outline':
      case 'ghost':
        return 'transparent';
      case 'danger':
        return COLORS.danger;
      case 'success':
        return COLORS.success;
      case 'dangerSoft':
        return COLORS.dangerLight;
      case 'primary':
      default:
        return COLORS.primary;
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'outline':
        return COLORS.primary;
      case 'ghost':
        return COLORS.textMain;
      case 'dangerSoft':
        return COLORS.danger;
      case 'primary':
      case 'secondary':
      case 'danger':
      default:
        return COLORS.white;
    }
  };

  const getLoaderColor = () => {
    if (variant === 'dangerSoft') return COLORS.danger;
    return variant === 'outline' || variant === 'ghost'
      ? COLORS.primary
      : COLORS.white;
  };

  const getBorderColor = () => {
    if (variant === 'outline') return COLORS.primary;
    if (variant === 'dangerSoft') return DANGER_SOFT_BORDER;
    return 'transparent';
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' && styles.sm,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          opacity: isDisabled ? 0.55 : pressed ? 0.88 : 1,
        },
        variant === 'outline' && styles.outline,
        variant === 'ghost' && styles.ghost,
        variant !== 'ghost' &&
          variant !== 'outline' &&
          variant !== 'dangerSoft' &&
          SHADOWS.light,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={getLoaderColor()}
        />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              size === 'sm' && styles.textSm,
              { color: getTextColor() },
              icon ? styles.textWithIcon : undefined,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
};

const DANGER_SOFT_BORDER = '#F6C9C4';

const styles = StyleSheet.create({
  sm: {
    minHeight: 40,
    minWidth: 80,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: SIZES.radiusSm,
  },

  textSm: {
    fontSize: 13,
    letterSpacing: 0.3,
  },

  base: {
    minHeight: 50,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  outline: {
    backgroundColor: COLORS.surface,
    ...SHADOWS.light,
  },

  ghost: {
    minHeight: 44,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 0,
  },

  text: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
    textAlign: 'center',
  },

  textWithIcon: {
    marginLeft: SPACING.sm,
  },
});

export default Button;