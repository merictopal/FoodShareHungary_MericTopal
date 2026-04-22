import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const COLORS = {
  // --- PREMIUM ORGANIC PALETTE ---
  primary: '#C94F3A',       // Warm, organic Terra Cotta (Replaces aggressive red)
  primaryDark: '#B04332',   // Hover/Active state for primary buttons
  primaryLight: '#FAEFEF',  // Accent color for active tabs
  secondary: '#2C3E50',     // Deep slate (Softer than harsh black)
  
  // --- SEMANTIC COLORS ---
  success: '#2A9D8F',       // Sophisticated Teal/Green for claims and success
  warning: '#F4A261',       // Warm Amber/Gold for leaderboard and warnings
  danger: '#E76F51',        // Soft error red (Matches the organic palette)
  info: '#264653',          // Deep modern tech blue
  
  // --- NEUTRAL & STRUCTURAL ---
  background: '#F8F5F0',    // Warm cream/beige background (Replaces sterile gray)
  surface: '#FFFFFF',       // Pure white for cards and modals
  inputFill: '#FFFFFF',     // Clean white background for inputs
  border: '#E5E7EB',        // Thin, elegant border color
  
  // --- TYPOGRAPHY ---
  textMain: '#1F2933',      // Main text (deep gray, high readability)
  textSub: '#4B5563',       // Darkened subtitle text for better contrast
  placeholder: '#9CA3AF',   // Eye-friendly placeholder gray
  white: '#FFFFFF',

  // --- EXTRAS ---
  gold: '#F4A261',          
  overlay: 'rgba(31, 41, 51, 0.4)', // Soft modern dark overlay
  shadow: '#1F2933',        // Transparent text color used for depth in shadows
};

export const SIZES = {
  base: 8,
  small: 12,
  font: 14,
  medium: 16,
  large: 18,
  extraLarge: 24,
  xxl: 32,
  
  width,
  height,
  
  radiusSm: 8,
  radius: 10,      // Slightly more angular, structured corners (was 12)
  radiusMd: 16,
  radiusLg: 24,
  radiusFull: 99,  // Perfect circles
};

export const SHADOWS = {
  // Shadows based on Apple HIG and Material 3 standards
  light: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03, 
    shadowRadius: 4,
    elevation: 1,
  },
  medium: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05, 
    shadowRadius: 8,
    elevation: 3,
  },
  heavy: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08, 
    shadowRadius: 16,
    elevation: 6,
  },
};