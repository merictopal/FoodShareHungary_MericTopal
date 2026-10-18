// Shared by the forgot-password and reset-password screens (same card layout)
import { StyleSheet } from 'react-native';

import {
  COLORS,
  SIZES,
  SPACING,
  SHADOWS,
  TYPOGRAPHY,
} from '../../constants/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    flexGrow: 1,

    alignItems: 'center',

    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.xxxl,
  },

  /* ---------------- ICON ---------------- */

  iconContainer: {
    width: 76,
    height: 76,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.primaryLight,

    borderRadius: SIZES.radiusFull,

    marginBottom: SPACING.lg,

    borderWidth: 1,
    borderColor: COLORS.primaryLight,

    ...SHADOWS.light,
  },

  /* ---------------- INTRO ---------------- */

  title: {
    ...TYPOGRAPHY.title,

    color: COLORS.textMain,

    textAlign: 'center',

    marginBottom: SPACING.sm,
  },

  subtitle: {
    maxWidth: 330,

    fontSize: 14,
    lineHeight: 21,

    color: COLORS.textSub,

    textAlign: 'center',

    marginBottom: SPACING.xxl,
  },

  /* ---------------- CARD ---------------- */

  card: {
    width: '100%',

    backgroundColor: COLORS.surface,

    borderRadius: SIZES.radiusXl,

    borderWidth: 1,
    borderColor: COLORS.border,

    padding: SPACING.xxl,

    ...SHADOWS.medium,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',

    marginBottom: SPACING.xxl,
  },

  cardIcon: {
    width: 40,
    height: 40,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.primaryLight,

    borderRadius: SIZES.radius,

    marginRight: SPACING.md,
  },

  cardHeaderText: {
    flex: 1,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: '800',

    color: COLORS.textMain,
  },

  cardSubtitle: {
    marginTop: 3,

    fontSize: 12,
    lineHeight: 18,

    color: COLORS.textMuted,
  },

  backButton: {
    marginTop: SPACING.md,
  },

  /* ---------------- SECURITY ---------------- */

  securityNote: {
    width: '100%',

    flexDirection: 'row',
    alignItems: 'flex-start',

    marginTop: SPACING.xl,

    paddingHorizontal: SPACING.sm,
  },

  securityText: {
    flex: 1,

    marginLeft: SPACING.sm,

    fontSize: 12,
    lineHeight: 18,

    color: COLORS.textMuted,
  },
});
