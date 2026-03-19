// --- STYLES FOR PROFILE SCREEN ---
import { StyleSheet } from 'react-native';
import { COLORS, SHADOWS } from '../../../constants/theme';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: COLORS.textSub, fontWeight: '600', letterSpacing: 0.5 },
  headerWrapper: { padding: 24, paddingBottom: 0 },
  
  // Profile Header Elements
  profileSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  avatarContainer: { width: 80, height: 80, borderRadius: 24, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginRight: 16, borderWidth: 3, borderColor: '#FFFFFF', ...SHADOWS.medium },
  avatarText: { fontSize: 32, color: '#FFFFFF', fontWeight: '900' },
  editIconBtn: { position: 'absolute', bottom: -5, right: -5, backgroundColor: '#FFFFFF', padding: 6, borderRadius: 12, borderWidth: 1, borderColor: '#EEEEEE', ...SHADOWS.light },
  editIconText: { fontSize: 12, fontWeight: '900', color: COLORS.textMain, marginTop: -2 },
  userInfo: { flex: 1 },
  userName: { fontSize: 24, fontWeight: '900', color: COLORS.textMain, marginBottom: 4, letterSpacing: -0.5 },
  userEmail: { fontSize: 13, color: COLORS.textSub, marginBottom: 12, fontWeight: '500' },
  
  // Badges
  badgeRow: { flexDirection: 'row' },
  roleBadge: { backgroundColor: '#F0F0F0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  roleText: { fontSize: 10, color: COLORS.textSub, fontWeight: '800', letterSpacing: 0.5 },
  rankBadge: { backgroundColor: '#FFF0F0', marginLeft: 8 },
  rankText: { fontSize: 10, color: COLORS.primary, fontWeight: '900', letterSpacing: 0.5 },
  badgeVerified: { backgroundColor: '#E8F5E9' }, 
  textVerified: { color: COLORS.success },
  badgePending: { backgroundColor: '#FFF8E1' }, 
  textPending: { color: '#F59E0B' },
  badgeUnverified: { backgroundColor: '#FEE2E2' }, 
  textUnverified: { color: COLORS.danger },
  
  // Verification Banner
  verificationBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', padding: 16, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: '#FEE2E2', ...SHADOWS.light },
  bannerIconBox: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FECACA', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  bannerIconText: { fontSize: 18, fontWeight: '900', color: COLORS.danger },
  bannerTextContent: { flex: 1 },
  bannerTitle: { fontSize: 13, fontWeight: '800', color: COLORS.danger, marginBottom: 2 },
  bannerSub: { fontSize: 11, color: '#991B1B', fontWeight: '500' },
  bannerArrow: { fontSize: 16, color: COLORS.danger, fontWeight: '900', marginLeft: 8 },
  
  // Progress Bar
  progressContainer: { marginBottom: 24, paddingHorizontal: 4 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  levelText: { fontSize: 12, fontWeight: '800', color: COLORS.textMain, textTransform: 'uppercase', letterSpacing: 0.5 },
  pointsText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  progressBarBg: { height: 8, backgroundColor: '#EEEEEE', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 4 },
  
  // Main Stats Card
  statsCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: '#F0F0F0', ...SHADOWS.light },
  statsTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textMain, marginBottom: 20, letterSpacing: 0.5, textTransform: 'uppercase' },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 24, fontWeight: '900', color: COLORS.textMain, letterSpacing: -0.5 },
  statLabel: { fontSize: 10, color: COLORS.textSub, marginTop: 6, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  verticalLine: { width: 1, height: 40, backgroundColor: '#F0F0F0' },
  
  // Detailed Stats Banner
  detailedStatsWrapper: { marginHorizontal: 0, marginBottom: 24, alignItems: 'center' },
  detailedStatsContainer: { flexDirection: 'row', width: '100%', height: 80, borderRadius: 16, overflow: 'hidden' },
  detailedStatHalf: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  detailedStatTitle: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  detailedStatValue: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginTop: 4 },
  totalBadgeContainer: { position: 'absolute', bottom: -10, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 4, borderRadius: 12, ...SHADOWS.light },
  totalBadgeText: { fontSize: 10, fontWeight: '800', color: COLORS.textMain },
  
  // Quick Menu
  quickMenu: { marginBottom: 24 },
  menuChip: { backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginRight: 12, borderWidth: 1, borderColor: '#EEEEEE', ...SHADOWS.light },
  menuText: { fontSize: 11, fontWeight: '800', color: COLORS.textMain, letterSpacing: 0.5 },
  
  // Filter Tabs
  tabsContainer: { flexDirection: 'row', backgroundColor: '#F5F5F5', borderRadius: 14, padding: 6, marginBottom: 20 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#FFFFFF', ...SHADOWS.light },
  tabText: { fontSize: 12, color: COLORS.textSub, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  tabTextActive: { color: COLORS.primary, fontWeight: '900' },
  
  // List Sections
  listSection: { marginBottom: 24 },
  sectionHeaderTitle: { fontSize: 18, fontWeight: '900', marginLeft: 24, marginBottom: 12, letterSpacing: -0.5 },
  
  // History Cards
  historyCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', marginBottom: 16, borderRadius: 20, overflow: 'hidden', height: 86, alignItems: 'center', marginHorizontal: 24, borderWidth: 1, borderColor: '#F5F5F5', ...SHADOWS.light },
  cardStrip: { width: 6, height: '100%' },
  cardIconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginLeft: 16, marginRight: 16 },
  cardIconLetter: { fontSize: 20, fontWeight: '900' },
  cardContent: { flex: 1, paddingVertical: 10, justifyContent: 'center' },
  restName: { fontSize: 15, fontWeight: '800', color: COLORS.textMain, marginBottom: 4, letterSpacing: -0.3 },
  offerName: { fontSize: 13, color: COLORS.textSub, marginBottom: 6, fontWeight: '500' },
  typeLabelRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  typeIndicatorDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  typeLabelText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  dateLabelText: { fontSize: 11, fontWeight: '700', color: COLORS.textMain, marginLeft: 4 },
  dateTextLarge: { fontSize: 14, color: COLORS.textMain, fontWeight: '900', marginTop: 6, letterSpacing: -0.3 },
  cardAction: { width: 76, alignItems: 'center', borderLeftWidth: 1, borderLeftColor: '#F5F5F5', height: '60%', justifyContent: 'center' },
  statusCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  statusCircleIcon: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  statusLabelText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  
  // Empty State
  emptyBox: { alignItems: 'center', marginTop: 40, paddingHorizontal: 40 },
  emptyIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyIconText: { fontSize: 28, fontWeight: '900', color: '#CCCCCC' },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textSub, textAlign: 'center', lineHeight: 22 },
  
  // Footer
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, backgroundColor: 'rgba(255,255,255,0.95)', borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  logoutBtn: { backgroundColor: '#FFF0F0', borderWidth: 1, borderColor: '#FFE5E5', borderRadius: 16, height: 56 },
  logoutText: { color: COLORS.danger, fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
  
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(31, 41, 51, 0.4)', justifyContent: 'flex-end', alignItems: 'center' },
  verificationModalCard: { width: '100%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 32, alignItems: 'center', ...SHADOWS.heavy },
  docModalSub: { fontSize: 13, color: COLORS.textSub, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  docTypeContainer: { width: '100%', marginBottom: 24 },
  docTypeBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#F9FAFB', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#F3F4F6' },
  docTypeBtnActive: { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' },
  docRadioBtn: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  docRadioBtnActive: { borderColor: COLORS.primary },
  docRadioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  docTypeText: { fontSize: 14, fontWeight: '600', color: COLORS.textMain },
  docTypeTextActive: { color: COLORS.primary, fontWeight: '800' },
  docImageContainer: { width: '100%', marginBottom: 24 },
  docUploadBtn: { width: '100%', height: 120, borderRadius: 16, borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed', backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center' },
  docUploadIcon: { fontSize: 32, marginBottom: 8 },
  docUploadText: { fontSize: 13, fontWeight: '700', color: COLORS.textSub },
  docPreviewWrapper: { width: '100%', alignItems: 'center' },
  docPreviewImage: { width: '100%', height: 160, borderRadius: 16, marginBottom: 12 },
  docChangeBtn: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#F3F4F6', borderRadius: 8 },
  docChangeText: { fontSize: 12, fontWeight: '800', color: COLORS.textMain },
  modalCard: { width: '100%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 32, alignItems: 'center', ...SHADOWS.heavy },
  modalHeader: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '900', color: COLORS.textMain, letterSpacing: -0.5 },
  closeIconText: { fontSize: 20, color: '#A0A0A0', fontWeight: '900' },
  qrContainer: { padding: 24, backgroundColor: '#F8F9FA', borderRadius: 24, marginBottom: 24, width: '100%', alignItems: 'center' },
  qrData: { fontSize: 24, fontWeight: '900', letterSpacing: 2, color: COLORS.textMain },
  modalInfo: { textAlign: 'center', color: COLORS.textSub, fontSize: 14, lineHeight: 22, fontWeight: '500', marginBottom: 24 },
  modalActionBtn: { width: '100%', height: 56, borderRadius: 16 },
  langModalCard: { backgroundColor: '#FFFFFF', width: '100%', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 32, alignItems: 'center', ...SHADOWS.heavy },
  langBtn: { width: '100%', padding: 20, borderRadius: 16, backgroundColor: '#FFFFFF', marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  langBtnActive: { backgroundColor: '#F5FBFF', borderColor: COLORS.primary },
  langText: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },
  langTextActive: { color: COLORS.primary, fontWeight: '900' },
  langBadge: { backgroundColor: '#F5F5F5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  langBadgeActive: { backgroundColor: COLORS.primary },
  langBadgeText: { fontSize: 12, fontWeight: '800', color: COLORS.textSub },
  langBadgeTextActive: { color: '#FFFFFF' },
  notifModalCard: { backgroundColor: '#FFFFFF', width: '100%', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 32, alignItems: 'center', ...SHADOWS.heavy },
  notifScrollView: { width: '100%', maxHeight: 400 },
  notifCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  notifTextContainer: { flex: 1, paddingRight: 16 },
  notifTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textMain, marginBottom: 4 },
  notifBody: { fontSize: 12, color: COLORS.textSub, marginBottom: 6, lineHeight: 18 },
  notifTime: { fontSize: 10, color: '#A0A0A0', fontWeight: '700' },
  notifUnreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary }
});