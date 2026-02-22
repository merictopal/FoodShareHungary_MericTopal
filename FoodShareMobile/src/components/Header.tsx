import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Platform, 
  StatusBar,
  ViewStyle,
  TextStyle
} from 'react-native';
import { COLORS, SHADOWS } from '../constants/theme';

// --- INTERFACES & TYPE DEFINITIONS ---
// Defining rigorous types for all possible props to ensure bulletproof component usage.
export interface HeaderProps {
  /** The main title of the header */
  title: string;
  
  /** Callback function when the left back button is pressed. If omitted, back button is hidden. */
  onBack?: () => void;
  
  /** The icon to display on the right side. Accepts a string (typographic icon) or a React Node */
  rightIcon?: string | React.ReactNode;
  
  /** Callback function when the right icon is pressed */
  onRightPress?: () => void;
  
  /** Shows a tiny notification dot on the right icon if true */
  showBadge?: boolean;
  
  /** If true, removes the background and borders. Useful for overlaying on maps or images (e.g., HomeScreen) */
  transparent?: boolean;
  
  /** Optional custom styles for the outer container */
  containerStyle?: ViewStyle;
  
  /** Optional custom styles for the title text */
  titleStyle?: TextStyle;
}

/**
 * Universal Header Component
 * Designed for both standard screens and transparent overlays.
 * Features enhanced accessibility and optimized touch targets.
 */
export const Header = ({ 
  title, 
  onBack, 
  rightIcon, 
  onRightPress, 
  showBadge = false,
  transparent = false,
  containerStyle,
  titleStyle
}: HeaderProps) => {

  // Dynamically calculate container styles based on the 'transparent' prop
  const dynamicContainerStyle: ViewStyle = transparent 
    ? {
        backgroundColor: 'transparent',
        borderBottomWidth: 0,
        elevation: 0, // Remove shadow on Android
        shadowOpacity: 0, // Remove shadow on iOS
      } 
    : {
        backgroundColor: COLORS.surface || '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
      };

  // Determine status bar style based on transparency (assumes dark map/background if transparent)
  const barStyle = transparent ? 'dark-content' : 'dark-content';

  return (
    <View style={[styles.container, dynamicContainerStyle, containerStyle]}>
      
      {/* --- STATUS BAR CONFIGURATION --- */}
      <StatusBar 
        barStyle={barStyle} 
        backgroundColor={transparent ? 'transparent' : (COLORS.surface || '#FFFFFF')} 
        translucent={transparent} 
      />
      
      {/* --- LEFT SECTION (Back Button) --- */}
      <View style={styles.left}>
        {onBack ? (
          <TouchableOpacity 
            onPress={onBack} 
            style={[styles.btn, transparent && styles.transparentBtn]}
            activeOpacity={0.6}
            // hitSlop expands the touchable area without changing the visual size (Crucial for UX)
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            {/* Typographic Back Arrow (Clean and professional, no emojis) */}
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
        ) : (
          // Placeholder to maintain center alignment if there is no back button
          <View style={{ width: 40 }} /> 
        )}
        
        {/* --- TITLE --- */}
        <Text 
          style={[styles.title, titleStyle]} 
          numberOfLines={1}
          accessibilityRole="header"
        >
          {title}
        </Text>
      </View>

      {/* --- RIGHT SECTION (Action Icon) --- */}
      <View style={styles.right}>
        {rightIcon && (
          <TouchableOpacity 
            onPress={onRightPress} 
            style={[styles.btn, transparent && styles.transparentBtn]}
            activeOpacity={0.6}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            accessibilityRole="button"
            accessibilityLabel="Header action"
          >
            {/* Handle both String (Typographic Icon) and ReactNode (SVG/Component) */}
            {typeof rightIcon === 'string' ? (
              <Text style={styles.rightIconText}>{rightIcon}</Text>
            ) : (
              rightIcon
            )}
            
            {/* Notification Badge */}
            {showBadge && <View style={styles.badge} />}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// --- STYLESHEET ---
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    // Add extra padding for iOS notch and Android status bar
    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 20) + 10,
    paddingBottom: 15,
    zIndex: 100, // Ensure header is always clickable and stays on top
  },
  
  left: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    flex: 1 
  },
  
  right: { 
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 40, // Ensures layout doesn't shift when icon is missing
  },
  
  title: { 
    fontSize: 18, 
    fontWeight: '800', 
    color: COLORS.textMain || '#1A1A1A', 
    marginLeft: 12,
    letterSpacing: 0.3,
    flexShrink: 1, // Prevents long titles from pushing the right icon off-screen
  },
  
  // Standard Button Container
  btn: { 
    width: 42, 
    height: 42, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderRadius: 12, // Modern rounded square
    backgroundColor: '#F5F5F5', 
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  
  // Special styling for buttons when header is transparent
  transparentBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    ...SHADOWS.light,
    borderColor: '#FFFFFF',
  },
  
  backIcon: { 
    fontSize: 22, 
    fontWeight: '600',
    color: COLORS.textMain || '#1A1A1A',
    marginTop: -2, // Optical alignment
  },
  
  rightIconText: { 
    fontSize: 16, 
    fontWeight: '900',
    color: COLORS.textMain || '#1A1A1A',
  },
  
  // Premium Notification Badge
  badge: {
    position: 'absolute', 
    top: 8, 
    right: 8,
    width: 12, 
    height: 12, 
    borderRadius: 6,
    backgroundColor: COLORS.danger || '#FF3B30', // Alert red
    borderWidth: 2, 
    borderColor: '#FFFFFF', // Creates a "cutout" effect
    elevation: 3,
  }
});