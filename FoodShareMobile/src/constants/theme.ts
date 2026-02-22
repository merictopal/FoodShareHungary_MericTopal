import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const COLORS = {
  // --- PREMIUM SOFT CORAL PALETTE ---
  primary: '#E85D5D',       // Soft, modern red (Soft Coral)
  primaryDark: '#D94B4B',   // Hover/Active state for buttons
  primaryLight: '#FDECEC',  // Accent color for language selector, active tabs
  secondary: '#374151',     // Modern dark slate gray (instead of harsh black)
  
  // --- SEMANTIC COLORS ---
  success: '#10B981',       // Emerald green
  warning: '#F59E0B',       // Amber
  danger: '#EF4444',        // Soft error red
  info: '#3B82F6',          // Modern tech blue
  
  // --- NEUTRAL & STRUCTURAL ---
  background: '#F7F7F8',    // Eye-friendly, premium light gray background
  surface: '#FFFFFF',       // Pure white for cards and modals
  inputFill: '#FFFFFF',     // Clean white background for inputs
  border: '#E5E7EB',        // Thin, elegant border color
  
  // --- TYPOGRAPHY ---
  textMain: '#1F2933',      // Main text (deep gray, not pure black)
  textSub: '#6B7280',       // Descriptions and subtexts
  placeholder: '#9CA3AF',   // Eye-friendly placeholder gray
  white: '#FFFFFF',

  // --- EXTRAS ---
  gold: '#F59E0B',          
  overlay: 'rgba(31, 41, 51, 0.4)', // Soft and modern dark overlay instead of pure black
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
  
  radius: 12,      // Ideal for modern SaaS buttons
  radiusMd: 16,
  radiusLg: 24,
  radiusFull: 99,
};

export const SHADOWS = {
  // Shadows based on Apple HIG and Material 3 standards
  light: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03, // Significantly reduced for a cleaner look
    shadowRadius: 4,
    elevation: 1,
  },
  medium: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05, // Softened shadow
    shadowRadius: 8,
    elevation: 3,
  },
  heavy: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08, // Aesthetic diffusion instead of harsh black shadows
    shadowRadius: 16,
    elevation: 6,
  },
};