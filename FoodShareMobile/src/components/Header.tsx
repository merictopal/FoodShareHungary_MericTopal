import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  COLORS,
  SIZES,
  SPACING,
  SHADOWS,
} from '../constants/theme';
import { useAuth } from '../context/AuthContext';

export interface HeaderProps {
  title: string;
  onBack?: () => void;
  rightIcon?: string | React.ReactNode;
  onRightPress?: () => void;
  // Screen-specific label for the right action (falls back to a generic one)
  rightIconLabel?: string;
  showBadge?: boolean;
  transparent?: boolean;
  containerStyle?: ViewStyle;
  titleStyle?: TextStyle;
}

export const Header = ({
  title,
  onBack,
  rightIcon,
  onRightPress,
  rightIconLabel,
  showBadge = false,
  transparent = false,
  containerStyle,
  titleStyle,
}: HeaderProps) => {
  const { t } = useAuth();

  const backgroundColor = transparent
    ? 'transparent'
    : COLORS.surface;

  const borderColor = transparent
    ? 'transparent'
    : COLORS.divider;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor,
          borderBottomColor: borderColor,
          borderBottomWidth: transparent ? 0 : 1,
        },
        transparent && styles.transparentContainer,
        containerStyle,
      ]}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor={
          transparent
            ? 'transparent'
            : COLORS.surface
        }
        translucent={transparent}
      />

      {/* LEFT */}
      <View style={styles.side}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={[
              styles.actionButton,
              transparent && styles.transparentButton,
            ]}
            activeOpacity={0.75}
            hitSlop={{
              top: 10,
              bottom: 10,
              left: 10,
              right: 10,
            }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y_go_back')}
          >
            <Ionicons
              name="chevron-back"
              size={23}
              color={COLORS.textMain}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      {/* TITLE */}
      <View style={styles.titleContainer}>
        <Text
          style={[
            styles.title,
            titleStyle,
          ]}
          numberOfLines={1}
          accessibilityRole="header"
        >
          {title}
        </Text>
      </View>

      {/* RIGHT */}
      <View style={[styles.side, styles.rightSide]}>
        {rightIcon ? (
          <TouchableOpacity
            onPress={onRightPress}
            style={[
              styles.actionButton,
              transparent && styles.transparentButton,
            ]}
            activeOpacity={0.75}
            hitSlop={{
              top: 10,
              bottom: 10,
              left: 10,
              right: 10,
            }}
            accessibilityRole="button"
            accessibilityLabel={rightIconLabel || t('a11y_header_action')}
          >
            {typeof rightIcon === 'string' ? (
              <Ionicons
                name={rightIcon as any}
                size={21}
                color={COLORS.textMain}
              />
            ) : (
              rightIcon
            )}

            {showBadge && (
              <View style={styles.badge} />
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: 72,

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: SPACING.lg,
    paddingTop:
      Platform.OS === 'ios'
        ? 10
        : (StatusBar.currentHeight || 0) + 4,
    paddingBottom: SPACING.md,

    zIndex: 100,
  },

  transparentContainer: {
    ...SHADOWS.light,
  },

  side: {
    width: 44,
    minWidth: 44,

    alignItems: 'flex-start',
    justifyContent: 'center',
  },

  rightSide: {
    alignItems: 'flex-end',
  },

  titleContainer: {
    flex: 1,

    alignItems: 'center',
    justifyContent: 'center',

    paddingHorizontal: SPACING.sm,
  },

  title: {
    fontSize: 18,
    fontWeight: '800',

    color: COLORS.textMain,

    letterSpacing: -0.15,
    textAlign: 'center',
  },

  actionButton: {
    width: 42,
    height: 42,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.surfaceSecondary,

    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  transparentButton: {
    backgroundColor: 'rgba(255,255,255,0.92)',

    borderColor: COLORS.surface,

    ...SHADOWS.light,
  },

  placeholder: {
    width: 42,
    height: 42,
  },

  badge: {
    position: 'absolute',

    top: 7,
    right: 7,

    width: 10,
    height: 10,

    borderRadius: 5,

    backgroundColor: COLORS.danger,

    borderWidth: 2,
    borderColor: COLORS.surface,
  },
});