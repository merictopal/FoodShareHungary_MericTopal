import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { COLORS, SIZES, SPACING, TYPOGRAPHY } from '../constants/theme';
import { Button } from './Button';

interface EmptyStateProps {
  icon: string;
  title: string;
  message?: string;
  // Only pass an action when it really does something (e.g. refresh)
  action?: { label: string; onPress: () => void };
  style?: ViewStyle;
}

export const EmptyState = ({ icon, title, message, action, style }: EmptyStateProps) => (
  <View style={[styles.container, style]}>
    <View style={styles.iconCircle}>
      <Ionicons name={icon} size={28} color={COLORS.textMuted} />
    </View>

    <Text style={styles.title}>{title}</Text>

    {message ? <Text style={styles.message}>{message}</Text> : null}

    {action ? (
      <Button
        title={action.label}
        onPress={action.onPress}
        size="sm"
        style={styles.action}
      />
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: SPACING.xxxl,
    paddingHorizontal: SPACING.xxxl,
  },

  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: SIZES.radiusFull,
    backgroundColor: COLORS.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },

  title: {
    color: COLORS.textSub,
    textAlign: 'center',
    lineHeight: 21,
    ...TYPOGRAPHY.bodyMedium,
  },

  message: {
    marginTop: SPACING.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    fontSize: 13,
  },

  action: {
    marginTop: SPACING.xxl,
    minWidth: 160,
  },
});

export default EmptyState;
