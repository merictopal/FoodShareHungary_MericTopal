import { StyleSheet } from 'react-native';

import {
  COLORS,
  SHADOWS,
  SIZES,
  SPACING,
  TYPOGRAPHY,
} from '../../../constants/theme';

export const styles = StyleSheet.create({
  // ======================================================
  // SCREEN
  // ======================================================

  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
  },

  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textSub,
    ...TYPOGRAPHY.bodyMedium,
  },

  headerWrapper: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.lg,
    paddingBottom: 0,
  },

  // ======================================================
  // PROFILE HEADER
  // ======================================================

  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },

  avatarContainer: {
    width: 82,
    height: 82,

    borderRadius: SIZES.radiusXl,

    backgroundColor: COLORS.primary,

    justifyContent: 'center',
    alignItems: 'center',

    marginRight: SPACING.lg,

    borderWidth: 3,
    borderColor: COLORS.surface,

    ...SHADOWS.medium,
  },

  avatarText: {
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.white,
  },

  editIconBtn: {
    position: 'absolute',

    bottom: -5,
    right: -5,

    width: 30,
    height: 30,

    borderRadius: SIZES.radiusFull,

    backgroundColor: COLORS.surface,

    justifyContent: 'center',
    alignItems: 'center',

    borderWidth: 1,
    borderColor: COLORS.border,

    ...SHADOWS.light,
  },

  userInfo: {
    flex: 1,
  },

  userName: {
    color: COLORS.textMain,

    ...TYPOGRAPHY.title,

    fontSize: 22,

    marginBottom: 4,
  },

  userEmail: {
    color: COLORS.textSub,

    fontSize: 13,
    fontWeight: '500',

    marginBottom: SPACING.md,
  },

  // ======================================================
  // BADGES
  // ======================================================

  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },

  roleBadge: {
    backgroundColor: COLORS.surfaceMuted,

    paddingHorizontal: 10,
    paddingVertical: 5,

    borderRadius: SIZES.radiusFull,
  },

  roleText: {
    fontSize: 11,
    color: COLORS.textSub,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  badgeVerified: {
    backgroundColor: COLORS.successLight,
  },

  textVerified: {
    color: COLORS.success,
  },

  badgePending: {
    backgroundColor: COLORS.warningLight,
  },

  textPending: {
    color: COLORS.warningText,
  },

  badgeUnverified: {
    backgroundColor: COLORS.dangerLight,
  },

  textUnverified: {
    color: COLORS.danger,
  },

  // ======================================================
  // VERIFICATION BANNER
  // ======================================================

  verificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',

    backgroundColor: COLORS.dangerLight,

    padding: SPACING.lg,

    borderRadius: SIZES.radiusMd,

    marginBottom: SPACING.xxl,

    borderWidth: 1,
    borderColor: '#F6C9C4',

    ...SHADOWS.light,
  },

  bannerIconBox: {
    width: 38,
    height: 38,

    borderRadius: SIZES.radius,

    backgroundColor: '#F9D8D4',

    justifyContent: 'center',
    alignItems: 'center',

    marginRight: SPACING.md,
  },

  bannerTextContent: {
    flex: 1,
  },

  bannerTitle: {
    fontSize: 13,
    fontWeight: '800',

    color: COLORS.danger,

    marginBottom: 3,
  },

  bannerSub: {
    fontSize: 11,
    lineHeight: 17,

    color: '#9E3B32',

    fontWeight: '500',
  },

  bannerArrow: {
    fontSize: 18,
    color: COLORS.danger,
    fontWeight: '700',
    marginLeft: SPACING.sm,
  },

  // ======================================================
  // XP / LEVEL PROGRESS
  // ======================================================

  progressContainer: {
    marginBottom: SPACING.xxl,

    paddingHorizontal: SPACING.xs,
  },

  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',

    marginBottom: SPACING.sm,
  },

  levelText: {
    color: COLORS.textMain,

    fontSize: 12,
    fontWeight: '700',

    letterSpacing: 0.3,
  },

  pointsText: {
    color: COLORS.primary,

    fontSize: 12,
    fontWeight: '800',
  },

  progressBarBg: {
    height: 9,

    backgroundColor: COLORS.surfaceMuted,

    borderRadius: SIZES.radiusFull,

    overflow: 'hidden',
  },

  progressBarFill: {
    height: '100%',

    backgroundColor: COLORS.primary,

    borderRadius: SIZES.radiusFull,
  },

  // ======================================================
  // MAIN STATS
  // ======================================================

  statsCard: {
    backgroundColor: COLORS.surface,

    borderRadius: SIZES.radiusXl,

    padding: SPACING.xxl,

    marginBottom: SPACING.xxl,

    borderWidth: 1,
    borderColor: COLORS.border,

    ...SHADOWS.light,
  },

  statsTitle: {
    color: COLORS.textMain,

    fontSize: 13,
    fontWeight: '800',

    marginBottom: SPACING.xl,

    letterSpacing: 0.3,
  },

  statsGrid: {
    flexDirection: 'row',

    justifyContent: 'space-between',
    alignItems: 'center',
  },

  statItem: {
    alignItems: 'center',
    flex: 1,
  },

  statValue: {
    fontSize: 24,
    fontWeight: '800',

    color: COLORS.textMain,

    letterSpacing: -0.5,
  },

  statLabel: {
    fontSize: 11,

    color: COLORS.textMuted,

    marginTop: 5,

    fontWeight: '700',

    letterSpacing: 0.3,
  },

  verticalLine: {
    width: 1,
    height: 42,

    backgroundColor: COLORS.divider,
  },

  // ======================================================
  // QUICK ACTIONS
  // ======================================================

  quickMenu: {
    marginBottom: SPACING.xxl,
  },

  menuChip: {
    flexDirection: 'row',
    alignItems: 'center',

    backgroundColor: COLORS.surface,

    paddingHorizontal: SPACING.lg,
    paddingVertical: 11,

    borderRadius: SIZES.radiusFull,

    marginRight: SPACING.sm,

    borderWidth: 1,
    borderColor: COLORS.border,

    ...SHADOWS.light,
  },

  menuText: {
    fontSize: 11,

    fontWeight: '700',

    color: COLORS.textSub,

    letterSpacing: 0.3,
  },

  // ======================================================
  // HISTORY TABS
  // ======================================================

  tabsContainer: {
    flexDirection: 'row',

    backgroundColor: COLORS.surfaceMuted,

    borderRadius: SIZES.radius,

    padding: 4,

    marginBottom: SPACING.lg,

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  tabBtn: {
    flex: 1,

    paddingVertical: 11,

    alignItems: 'center',

    borderRadius: SIZES.radiusSm,
  },

  tabActive: {
    backgroundColor: COLORS.surface,

    ...SHADOWS.light,
  },

  tabText: {
    fontSize: 11,

    color: COLORS.textMuted,

    fontWeight: '700',

    letterSpacing: 0.3,
  },

  tabTextActive: {
    color: COLORS.primary,

    fontWeight: '800',
  },

  // ======================================================
  // LIST SECTIONS
  // ======================================================

  listSection: {
    marginBottom: SPACING.xxl,
  },

  sectionHeaderTitle: {
    fontSize: 18,

    fontWeight: '800',

    color: COLORS.textMain,

    marginLeft: SPACING.xxl,
    marginBottom: SPACING.md,

    letterSpacing: -0.2,
  },

  // ======================================================
  // HISTORY CARDS
  // ======================================================

  historyCard: {
  flexDirection: 'row',
  alignItems: 'center',

  height: 96,

  backgroundColor: COLORS.surface,

  marginBottom: SPACING.md,
  marginHorizontal: SPACING.xxl,

  borderRadius: SIZES.radiusMd,

  overflow: 'hidden',

  borderWidth: 1,
  borderColor: COLORS.border,

  ...SHADOWS.light,
},

  cardStrip: {
    width: 5,
    height: '100%',
  },

  cardIconBox: {
    width: 48,
    height: 48,

    borderRadius: SIZES.radius,

    justifyContent: 'center',
    alignItems: 'center',

    marginLeft: SPACING.lg,
    marginRight: SPACING.md,
  },

  cardIconLetter: {
    fontSize: 19,

    fontWeight: '800',
  },

  cardContent: {
  flex: 1,

  paddingVertical: SPACING.sm,

  justifyContent: 'center',

  minWidth: 0,
},

  restName: {
    fontSize: 15,

    fontWeight: '800',

    color: COLORS.textMain,

    marginBottom: 3,
  },

  offerName: {
    fontSize: 12,

    color: COLORS.textSub,

    marginBottom: 4,

    fontWeight: '500',
  },

  typeLabelRow: {
    flexDirection: 'row',

    alignItems: 'center',

    marginTop: 4,
  },

  typeIndicatorDot: {
    width: 6,
    height: 6,

    borderRadius: SIZES.radiusFull,

    marginRight: 6,
  },

  typeLabelText: {
    fontSize: 11,

    fontWeight: '800',

    letterSpacing: 0.3,
  },

  dateLabelText: {
    fontSize: 11,

    fontWeight: '600',

    color: COLORS.textMuted,

    marginLeft: 4,
  },

  dateTextLarge: {
    fontSize: 13,

    color: COLORS.textMain,

    fontWeight: '800',

    marginTop: 4,
  },

  cardAction: {
  width: 76,
  height: '100%',

  alignItems: 'center',
  justifyContent: 'center',

  borderLeftWidth: 1,
  borderLeftColor: COLORS.divider,
},

  statusCircle: {
    width: 38,
    height: 38,

    borderRadius: SIZES.radiusFull,

    justifyContent: 'center',
    alignItems: 'center',

    marginBottom: 3,
  },

  // 10px (not 11): HU "FOLYAMATBAN" must fit the 76px status column
  statusLabelText: {
    fontSize: 10,

    fontWeight: '800',
  },

  // ======================================================
  // FOOTER / LOGOUT
  // ======================================================

  footer: {
  paddingHorizontal: SPACING.xxl,
  paddingTop: SPACING.lg,
  paddingBottom: SPACING.xxl,
  backgroundColor: COLORS.background,
},

  logoutBtn: {
    height: 52,
  },

  deleteAccountBtn: {
    marginTop: SPACING.md,
    borderColor: COLORS.danger,
    height: 52,
  },

  logoutText: {
    color: COLORS.danger,

    fontWeight: '700',

    fontSize: 14,

    letterSpacing: 0.2,
  },

  // ======================================================
  // MODALS
  // ======================================================

  docModalSub: {
    fontSize: 13,

    color: COLORS.textSub,

    textAlign: 'center',

    marginBottom: SPACING.xxl,

    lineHeight: 20,
  },

  docTypeContainer: {
    width: '100%',

    marginBottom: SPACING.xxl,
  },

  docTypeBtn: {
    flexDirection: 'row',

    alignItems: 'center',

    padding: SPACING.lg,

    backgroundColor: COLORS.surfaceSecondary,

    borderRadius: SIZES.radius,

    marginBottom: SPACING.sm,

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  docTypeBtnActive: {
    backgroundColor: COLORS.infoLight,

    borderColor: '#B7D7DE',
  },

  docRadioBtn: {
    width: 20,
    height: 20,

    borderRadius: SIZES.radiusFull,

    borderWidth: 2,

    borderColor: COLORS.borderStrong,

    marginRight: SPACING.md,

    justifyContent: 'center',
    alignItems: 'center',
  },

  docRadioBtnActive: {
    borderColor: COLORS.primary,
  },

  docRadioInner: {
    width: 10,
    height: 10,

    borderRadius: SIZES.radiusFull,

    backgroundColor: COLORS.primary,
  },

  docTypeText: {
    fontSize: 14,

    fontWeight: '600',

    color: COLORS.textMain,
  },

  docTypeTextActive: {
    color: COLORS.primary,

    fontWeight: '800',
  },

  docImageContainer: {
    width: '100%',

    marginBottom: SPACING.xxl,
  },

  docUploadBtn: {
    width: '100%',
    height: 120,

    borderRadius: SIZES.radiusMd,

    borderWidth: 1.5,
    borderColor: COLORS.borderStrong,
    borderStyle: 'dashed',

    backgroundColor: COLORS.surfaceSecondary,

    justifyContent: 'center',
    alignItems: 'center',
  },

  docUploadIcon: {
    fontSize: 30,

    marginBottom: SPACING.sm,
  },

  docUploadText: {
    fontSize: 13,

    fontWeight: '700',

    color: COLORS.textSub,
  },

  docPreviewWrapper: {
    width: '100%',

    alignItems: 'center',
  },

  docPreviewImage: {
    width: '100%',
    height: 160,

    borderRadius: SIZES.radiusMd,

    marginBottom: SPACING.md,
  },

  docChangeBtn: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,

    backgroundColor: COLORS.surfaceMuted,

    borderRadius: SIZES.radiusSm,
  },

  docChangeText: {
    fontSize: 12,

    fontWeight: '700',

    color: COLORS.textMain,
  },

  qrContainer: {
    padding: SPACING.xxl,

    backgroundColor: COLORS.surfaceMuted,

    borderRadius: SIZES.radiusLg,

    marginBottom: SPACING.xxl,

    width: '100%',

    alignItems: 'center',

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  qrData: {
    fontSize: 24,

    fontWeight: '800',

    letterSpacing: 2,

    color: COLORS.textMain,
  },

  modalInfo: {
    textAlign: 'center',

    color: COLORS.textSub,

    fontSize: 14,

    lineHeight: 21,

    fontWeight: '500',

    marginBottom: SPACING.xxl,
  },

  modalActionBtn: {
    width: '100%',

    height: 54,

    borderRadius: SIZES.radius,

  },

  // ======================================================
  // LANGUAGE MODAL
  // ======================================================

  langBtn: {
    width: '100%',

    padding: SPACING.lg,

    borderRadius: SIZES.radiusMd,

    backgroundColor: COLORS.surface,

    marginBottom: SPACING.sm,

    flexDirection: 'row',

    justifyContent: 'space-between',

    alignItems: 'center',

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  langBtnActive: {
    backgroundColor: COLORS.primaryLight,

    borderColor: '#E5C2BB',
  },

  langText: {
    fontSize: 15,

    fontWeight: '600',

    color: COLORS.textMain,
  },

  langTextActive: {
    color: COLORS.primary,

    fontWeight: '800',
  },

  langBadge: {
    backgroundColor: COLORS.surfaceMuted,

    paddingHorizontal: 10,
    paddingVertical: 5,

    borderRadius: SIZES.radiusFull,
  },

  langBadgeActive: {
    backgroundColor: COLORS.primary,
  },

  langBadgeText: {
    fontSize: 11,

    fontWeight: '700',

    color: COLORS.textSub,
  },

  langBadgeTextActive: {
    color: COLORS.white,
  },

  // ======================================================
  // NOTIFICATIONS MODAL
  // ======================================================

  notifScrollView: {
    width: '100%',

    maxHeight: 400,
  },

  notifCard: {
    flexDirection: 'row',

    justifyContent: 'space-between',

    alignItems: 'center',

    paddingVertical: SPACING.lg,

    borderBottomWidth: 1,

    borderBottomColor: COLORS.divider,
  },

  notifTextContainer: {
    flex: 1,

    paddingRight: SPACING.lg,
  },

  notifTitle: {
    fontSize: 14,

    fontWeight: '800',

    color: COLORS.textMain,

    marginBottom: 4,
  },

  notifBody: {
    fontSize: 12,

    color: COLORS.textSub,

    marginBottom: 6,

    lineHeight: 18,
  },

  notifTime: {
    fontSize: 11,

    color: COLORS.textMuted,

    fontWeight: '600',
  },

  notifLoadingBox: {
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xxl,
  },

  notifEmpty: {
    marginTop: 0,
    paddingBottom: SPACING.lg,
  },

  notifUnreadDot: {
    width: 9,
    height: 9,

    borderRadius: SIZES.radiusFull,

    backgroundColor: COLORS.primary,
  },
});