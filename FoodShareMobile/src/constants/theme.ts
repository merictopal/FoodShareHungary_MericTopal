import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const COLORS = {
  // Brand
  primary: '#C94F3A',
  primaryDark: '#B04332',
  primaryLight: '#FAEFEF',

  // Supporting colors
  secondary: '#2C3E50',
  success: '#2A9D8F',
  successLight: '#E8F6F3',
  warning: '#F4A261',
  warningLight: '#FFF4E8',
  // Text/icon colour for warning & discount content: `warning` is too light for text (~2:1 on warningLight)
  warningText: '#B45309',
  danger: '#E76F51',
  dangerLight: '#FDECEA',
  info: '#264653',
  infoLight: '#EAF2F4',

  // Surfaces
  background: '#F8F5F0',
  surface: '#FFFFFF',
  surfaceSecondary: '#F7F7F8',
  surfaceMuted: '#F3F4F6',

  // Inputs / borders
  inputFill: '#FFFFFF',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  divider: '#ECEEF0',

  // Typography
  textMain: '#1F2933',
  textSub: '#4B5563',
  textMuted: '#6B7280',
  placeholder: '#9CA3AF',

  // Common
  white: '#FFFFFF',
  black: '#000000',
  gold: '#F4A261',
  overlay: 'rgba(31, 41, 51, 0.45)',
  shadow: '#1F2933',
};

export const SIZES = {
  base: 8,
  xs: 4,
  small: 12,
  font: 14,
  medium: 16,
  large: 18,
  extraLarge: 24,
  xxl: 32,

  width,
  height,

  // Radius system
  radiusXs: 6,
  radiusSm: 8,
  radius: 12,
  radiusMd: 16,
  radiusLg: 20,
  radiusXl: 24,
  radiusFull: 999,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 40,
};

export const TYPOGRAPHY = {
  display: {
    fontSize: 30,
    fontWeight: '800' as const,
    letterSpacing: -0.7,
  },

  title: {
    fontSize: 24,
    fontWeight: '800' as const,
    letterSpacing: -0.4,
  },

  heading: {
    fontSize: 18,
    fontWeight: '700' as const,
    letterSpacing: -0.1,
  },

  body: {
    fontSize: 15,
    fontWeight: '400' as const,
  },

  bodyMedium: {
    fontSize: 15,
    fontWeight: '500' as const,
  },

  bodyBold: {
    fontSize: 14,
    fontWeight: '700' as const,
  },

  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
  },

  label: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 0.4,
  },
};

export const SHADOWS = {
  light: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },

  medium: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 7,
    elevation: 2,
  },

  heavy: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
};