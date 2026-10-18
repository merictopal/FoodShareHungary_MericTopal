import { StyleSheet, Dimensions } from 'react-native';

import {
  COLORS,
  SHADOWS,
  SIZES,
  SPACING,
  TYPOGRAPHY,
} from '../../../constants/theme';

const { width, height } = Dimensions.get('window');

const MAP_HEIGHT_RATIO = 0.34;

// How far the offer list sheet slides up over the bottom of the map
export const SHEET_OVERLAP = 24;

export const mapStyle = [
  {
    elementType: 'geometry',
    stylers: [{ color: '#F2F4F3' }],
  },
  {
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#68736F' }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#F2F4F3' }],
  },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#B5BCB8' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#E9EEEB' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#7A8580' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#DDE8E0' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#819187' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#FFFFFF' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#727C78' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#D8DDD9' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#626D68' }],
  },
  {
    featureType: 'road.local',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#8D9692' }],
  },
  {
    featureType: 'transit.line',
    elementType: 'geometry',
    stylers: [{ color: '#E0E5E2' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'geometry',
    stylers: [{ color: '#E7ECE9' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#C9D9D8' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#7B8C8A' }],
  },
];

export const styles = StyleSheet.create({

  // =========================================================
  // MAIN
  // =========================================================

  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // =========================================================
  // MAP
  // =========================================================

  mapSection: {
    height: height * MAP_HEIGHT_RATIO,
    width,
    backgroundColor: COLORS.surfaceMuted,
  },

  map: {
    ...StyleSheet.absoluteFillObject,
  },

  // =========================================================
  // HOME HEADER
  // =========================================================

  homeHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.md,

    backgroundColor: 'rgba(248,245,240,0.96)',

    borderBottomWidth: 1,
    borderBottomColor: 'rgba(31,41,51,0.08)',

    zIndex: 20,
  },

  // In-flow (not absolute) so it gives the header its height now that the
  // duplicate profile shortcut is gone; minHeight keeps the previous bar height.
  greetingContainer: {
    flex: 1,
    minHeight: 46,

    alignItems: 'center',
    justifyContent: 'center',
  },

  greetingText: {
    color: COLORS.textMain,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  greetingSubtext: {
    display: 'none',
  },

  // Kept for compatibility
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },

  // =========================================================
  // LOCATION BUTTON
  // =========================================================

  myLocationBtn: {
    position: 'absolute',

    bottom: 28,
    right: 20,

    width: 48,
    height: 48,

    borderRadius: SIZES.radiusFull,

    justifyContent: 'center',
    alignItems: 'center',

    backgroundColor: COLORS.surface,

    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',

    ...SHADOWS.medium,
  },

  locationIcon: {
    fontSize: 25,
    color: COLORS.secondary,
    fontWeight: '400',
    marginBottom: 1,
  },

  // =========================================================
  // BOTTOM SHEET
  // =========================================================

  listContainer: {
    flex: 1,

    backgroundColor: COLORS.background,

    borderTopLeftRadius: SIZES.radiusXl,
    borderTopRightRadius: SIZES.radiusXl,

    marginTop: -SHEET_OVERLAP,

    paddingTop: SPACING.md,

    overflow: 'hidden',

    ...SHADOWS.heavy,
  },

  handleBar: {
    width: 42,
    height: 4,

    backgroundColor: COLORS.borderStrong,

    borderRadius: SIZES.radiusFull,

    alignSelf: 'center',

    marginBottom: SPACING.lg,
  },

  centerContent: {
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

  // =========================================================
  // SECTIONS
  // =========================================================

  sectionContainer: {
    marginBottom: SPACING.xxl,
    marginTop: SPACING.xs,
  },

  sectionTitle: {
    marginLeft: SPACING.xxl,
    marginBottom: SPACING.md,

    color: COLORS.textMain,

    ...TYPOGRAPHY.heading,
  },

  // =========================================================
  // LEADERBOARD
  // =========================================================

  lbCard: {
    width: 138,
    minHeight: 142,

    marginRight: SPACING.md,

    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,

    borderRadius: SIZES.radiusMd,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.surface,

    borderWidth: 1,
    borderColor: COLORS.border,

    ...SHADOWS.light,
  },

  lbCardHighlight: {
    backgroundColor: COLORS.primaryLight,
    borderColor: '#E8C5BE',
  },

  lbRank: {
    fontSize: 23,
    fontWeight: '800',

    color: COLORS.primary,

    marginBottom: SPACING.xs,
  },

  lbName: {
    color: COLORS.textMain,

    textAlign: 'center',

    marginBottom: SPACING.sm,

    ...TYPOGRAPHY.bodyBold,
  },

  lbStats: {
    alignItems: 'center',
  },

  lbPoints: {
    color: COLORS.primary,

    ...TYPOGRAPHY.caption,

    fontWeight: '700',
  },

  lbMeals: {
    color: COLORS.textMuted,

    marginTop: 2,

    ...TYPOGRAPHY.caption,
  },

  // =========================================================
  // RECOMMENDED / AI CARDS
  // =========================================================

  aiCard: {
    width: width * 0.68,

    marginRight: SPACING.md,

    padding: SPACING.lg,

    borderRadius: SIZES.radiusMd,

    backgroundColor: COLORS.surface,

    borderWidth: 1,
    borderColor: COLORS.border,

    ...SHADOWS.light,
  },

  aiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',

    marginBottom: SPACING.md,
  },

  aiImage: {
    width: 46,
    height: 46,

    borderRadius: SIZES.radius,

    marginRight: SPACING.md,

    backgroundColor: COLORS.surfaceMuted,
  },

  aiIconBox: {
    width: 46,
    height: 46,

    borderRadius: SIZES.radius,

    justifyContent: 'center',
    alignItems: 'center',

    marginRight: SPACING.md,
  },

  aiIconLetter: {
    fontSize: 19,
    fontWeight: '800',
  },

  aiInfo: {
    flex: 1,
  },

  aiTitle: {
    color: COLORS.textMain,
    ...TYPOGRAPHY.bodyBold,
  },

  aiDesc: {
    color: COLORS.textMuted,

    marginTop: 3,

    ...TYPOGRAPHY.caption,
  },

  aiFooter: {
    flexDirection: 'row',

    justifyContent: 'space-between',
    alignItems: 'center',
  },

  aiClaimBtn: {
    height: 36,

    paddingHorizontal: SPACING.md,

    borderRadius: SIZES.radiusSm,
  },

  // =========================================================
  // FILTERS
  // =========================================================

  filterContainer: {
    flexDirection: 'row',

    paddingHorizontal: SPACING.xxl,

    paddingTop: SPACING.xs,
    paddingBottom: SPACING.lg,

    backgroundColor: COLORS.background,

    gap: SPACING.sm,
  },

  filterBtn: {
    paddingVertical: 10,
    paddingHorizontal: SPACING.lg,

    borderRadius: SIZES.radiusFull,

    backgroundColor: COLORS.surface,

    borderWidth: 1,
    borderColor: COLORS.border,

    ...SHADOWS.light,
  },

  filterBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  filterText: {
    color: COLORS.textSub,
    ...TYPOGRAPHY.label,
  },

  filterTextActive: {
    color: COLORS.white,
  },

  // =========================================================
  // ACTIVE OFFERS
  // =========================================================

  offersSection: {
    paddingBottom: SPACING.xxl,
  },

  offersLoading: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
  },

  offersErrorNotice: {
    marginHorizontal: SPACING.xxl,
    marginBottom: SPACING.md,
    color: COLORS.textSub,
    textAlign: 'center',
    ...TYPOGRAPHY.bodyMedium,
  },

  offerCard: {
    flexDirection: 'row',
    alignItems: 'center',

    marginHorizontal: SPACING.xxl,
    marginBottom: SPACING.md,

    padding: SPACING.lg,

    borderRadius: SIZES.radiusMd,

    backgroundColor: COLORS.surface,

    borderWidth: 1,
    borderColor: COLORS.border,

    ...SHADOWS.light,
  },

  cardIconImage: {
    width: 54,
    height: 54,

    borderRadius: SIZES.radius,

    marginRight: SPACING.md,

    backgroundColor: COLORS.surfaceMuted,
  },

  cardIconBox: {
    width: 54,
    height: 54,

    borderRadius: SIZES.radius,

    justifyContent: 'center',
    alignItems: 'center',

    marginRight: SPACING.md,
  },

  cardIconLetter: {
    fontSize: 22,
    fontWeight: '800',
  },

  cardInfo: {
    flex: 1,
    minWidth: 0,
  },

  cardHeaderRow: {
    flexDirection: 'row',

    justifyContent: 'space-between',
    alignItems: 'center',
  },

  cardTitle: {
    flex: 1,

    color: COLORS.textMain,

    marginRight: SPACING.sm,

    ...TYPOGRAPHY.bodyBold,
  },

  distText: {
    color: COLORS.textMuted,

    ...TYPOGRAPHY.caption,
  },

  cardDesc: {
    color: COLORS.textMuted,

    marginTop: SPACING.xs,
    marginBottom: SPACING.md,

    ...TYPOGRAPHY.caption,
  },

  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',

    alignItems: 'center',

    columnGap: SPACING.md,
    rowGap: SPACING.xs,
  },

  stockText: {
    color: COLORS.textMuted,
    ...TYPOGRAPHY.caption,
  },

  cardAction: {
    marginLeft: SPACING.md,
  },

  miniBtn: {
    width: 76,
    height: 40,

    borderRadius: SIZES.radiusSm,
  },

  // =========================================================
  // MAP MARKERS
  // =========================================================

  customMarker: {
    width: 34,
    height: 34,

    padding: 5,

    borderRadius: SIZES.radiusFull,

    justifyContent: 'center',
    alignItems: 'center',

    backgroundColor: COLORS.surface,

    borderWidth: 2.5,

    ...SHADOWS.medium,
  },

  markerText: {
    fontSize: 14,
    fontWeight: '800',
  },

  borderSuccess: {
    borderColor: COLORS.success,
  },

  borderWarning: {
    borderColor: COLORS.warning,
  },

  markerWrap: {
    padding: 6,
  },

  // Active offer count of a restaurant marker
  markerCountBadge: {
    position: 'absolute',
    top: 0,
    right: 0,

    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,

    borderRadius: SIZES.radiusFull,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.primary,
  },

  markerCountText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
  },

  // =========================================================
  // COLOR HELPERS
  // =========================================================

  bgSuccess: {
    backgroundColor: COLORS.success,
  },

  bgWarning: {
    backgroundColor: COLORS.warning,
  },

  textSuccess: {
    color: COLORS.success,
  },

  textWarning: {
    color: COLORS.warning,
  },

  // =========================================================
  // QR SUCCESS MODAL
  // =========================================================

  modalOverlay: {
    flex: 1,

    backgroundColor: COLORS.overlay,

    justifyContent: 'center',
    alignItems: 'center',

    padding: SPACING.xxl,
  },

  modalCard: {
    width: '100%',

    padding: SPACING.xxxl,

    alignItems: 'center',

    backgroundColor: COLORS.surface,

    borderRadius: SIZES.radiusXl,

    ...SHADOWS.heavy,
  },

  modalTitleSuccess: {
    color: COLORS.primary,

    marginBottom: SPACING.lg,

    ...TYPOGRAPHY.title,

    textAlign: 'center',
  },

  modalInfoText: {
    color: COLORS.textSub,

    textAlign: 'center',

    marginBottom: SPACING.xxl,

    lineHeight: 21,

    ...TYPOGRAPHY.body,
  },

  qrCodeWrapper: {
    padding: SPACING.xl,

    marginBottom: SPACING.xxl,

    backgroundColor: COLORS.surfaceMuted,

    borderRadius: SIZES.radiusMd,
  },
});