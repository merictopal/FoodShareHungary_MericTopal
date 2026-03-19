import { StyleSheet, Dimensions, Platform } from 'react-native';
import { COLORS, SHADOWS } from '../../../constants/theme';

const { width, height } = Dimensions.get('window');
const MAP_HEIGHT_RATIO = 0.38; 

export const mapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] },
  { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] },
  { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] },
  { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
  { "featureType": "road.arterial", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#dadada" }] },
  { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
  { "featureType": "road.local", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
  { "featureType": "transit.line", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] },
  { "featureType": "transit.station", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#c9c9c9" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] }
];

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  
  // Map Elements
  mapSection: { height: height * MAP_HEIGHT_RATIO, width: width, backgroundColor: '#EAECEF' },
  map: { ...StyleSheet.absoluteFillObject },
  headerOverlay: { position: 'absolute', top: Platform.OS === 'ios' ? 40 : 30, left: 0, right: 0, zIndex: 10 },
  myLocationBtn: { position: 'absolute', bottom: 30, right: 20, backgroundColor: '#FFFFFF', width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', ...SHADOWS.medium },
  locationIcon: { fontSize: 26, color: COLORS.textMain, fontWeight: '400', marginBottom: 2 },

  // Bottom Sheet List
  listContainer: { flex: 1, backgroundColor: COLORS.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: -24, paddingTop: 12, overflow: 'hidden', ...SHADOWS.heavy },
  handleBar: { width: 48, height: 5, backgroundColor: '#D1D5DB', borderRadius: 4, alignSelf: 'center', marginBottom: 16 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, color: COLORS.textSub, fontSize: 14, fontWeight: '600' },

  // Sections
  sectionContainer: { marginBottom: 24, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: COLORS.textMain, marginLeft: 24, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Leaderboard
  lbCard: { backgroundColor: '#FFFFFF', paddingVertical: 16, paddingHorizontal: 12, borderRadius: 16, marginRight: 16, width: 130, alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6', ...SHADOWS.light },
  lbCardHighlight: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' },
  lbRank: { fontSize: 24, fontWeight: '900', marginBottom: 6 },
  lbName: { fontSize: 14, fontWeight: '800', color: COLORS.textMain, textAlign: 'center', marginBottom: 6, letterSpacing: -0.3 },
  lbStats: { alignItems: 'center' },
  lbPoints: { fontSize: 11, color: COLORS.primary, fontWeight: '900', letterSpacing: 0.5 },
  lbMeals: { fontSize: 10, color: COLORS.textSub, marginTop: 2, fontWeight: '600' },

  // AI Cards
  aiCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginRight: 16, width: width * 0.65, borderWidth: 1, borderColor: '#E5E7EB', ...SHADOWS.light },
  aiCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  aiImage: { width: 44, height: 44, borderRadius: 12, marginRight: 12, backgroundColor: '#EAECEF' },
  aiIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  aiIconLetter: { fontSize: 20, fontWeight: '900' },
  aiInfo: { flex: 1 },
  aiTitle: { fontSize: 14, fontWeight: '900', color: COLORS.textMain, letterSpacing: -0.3 },
  aiDesc: { fontSize: 11, color: '#6B7280', marginTop: 2, fontWeight: '500' },
  aiFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  aiClaimBtn: { height: 32, paddingHorizontal: 12, borderRadius: 10 },

  // Filters
  filterContainer: { flexDirection: 'row', paddingHorizontal: 24, paddingBottom: 16, backgroundColor: COLORS.background, gap: 12, paddingTop: 8 },
  filterBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', ...SHADOWS.light },
  filterBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 12, color: COLORS.textSub, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  filterTextActive: { color: '#FFFFFF' },

  // Offers List
  offersSection: { paddingBottom: 24 },
  offerCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginHorizontal: 24, marginBottom: 16, alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6', ...SHADOWS.light },
  cardIconImage: { width: 52, height: 52, borderRadius: 16, marginRight: 16, backgroundColor: '#EAECEF' },
  cardIconBox: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  cardIconLetter: { fontSize: 24, fontWeight: '900' },
  cardInfo: { flex: 1 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '900', color: COLORS.textMain, letterSpacing: -0.3 },
  distText: { fontSize: 11, color: COLORS.textSub, fontWeight: '700' },
  cardDesc: { fontSize: 13, color: '#6B7280', marginTop: 4, marginBottom: 10, fontWeight: '500' },
  tagsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tagBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  stockText: { fontSize: 11, color: '#9CA3AF', fontWeight: '700' },
  cardAction: { marginLeft: 12 },
  miniBtn: { width: 72, height: 40, borderRadius: 12 },

  // Empty State
  emptyContainer: { alignItems: 'center', marginTop: 40, paddingHorizontal: 40 },
  emptyIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyIconText: { fontSize: 28, fontWeight: '900', color: '#D1D5DB' },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textSub, textAlign: 'center' },

  // Custom Map Markers & Callout
  customMarker: { backgroundColor: '#FFFFFF', padding: 6, borderRadius: 20, borderWidth: 3, ...SHADOWS.medium, width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  markerText: { fontSize: 14, fontWeight: '900' },
  borderSuccess: { borderColor: COLORS.success },
  borderWarning: { borderColor: COLORS.warning },
  calloutBubble: { backgroundColor: '#FFFFFF', padding: 12, borderRadius: 16, width: 160, alignItems: 'center', ...SHADOWS.medium },
  calloutTitle: { fontWeight: '900', fontSize: 13, marginBottom: 4, color: COLORS.textMain },
  calloutDesc: { fontSize: 11, color: COLORS.textSub, marginBottom: 10, fontWeight: '500' },
  calloutBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  calloutBtnText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  // Color Helpers
  bgSuccess: { backgroundColor: COLORS.success },
  bgWarning: { backgroundColor: COLORS.warning },
  textSuccess: { color: COLORS.success },
  textWarning: { color: COLORS.warning },

  // Modal Specific Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 32, alignItems: 'center', ...SHADOWS.heavy },
  modalTitleSuccess: { fontSize: 20, fontWeight: '900', color: COLORS.primary, marginBottom: 16 },
  modalInfoText: { fontSize: 14, color: COLORS.textSub, textAlign: 'center', marginBottom: 24, fontWeight: '500' },
  qrCodeWrapper: { padding: 20, backgroundColor: '#F8F9FA', borderRadius: 20, marginBottom: 24 }
});