import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Dimensions, 
  FlatList, 
  TouchableOpacity, 
  Alert, 
  StatusBar, 
  Platform,
  ActivityIndicator,
  RefreshControl,
  ScrollView
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useAuth } from '../../context/AuthContext';
import { offersApi } from '../../api/offers';
import { client } from '../../api/client';
import { COLORS, SHADOWS } from '../../constants/theme';
import { Header } from '../../components/Header';
import { Button } from '../../components/Button';

// --- CONSTANTS & TYPES ---
const { width, height } = Dimensions.get('window');
const MAP_HEIGHT_RATIO = 0.38; 

export interface Offer {
  id: number;
  restaurant: string;
  type: 'free' | 'discount';
  description: string;
  quantity: number;
  discount_rate: number;
  lat: number | string;
  lng: number | string;
  distance?: number;
}

export interface LeaderboardEntry {
  restaurant: string;
  points: number;
  meals: number;
}

type FilterType = 'all' | 'free' | 'discount';

const HomeScreen = ({ navigation }: any) => {
  // --- HOOKS & CONTEXT ---
  const { user, t } = useAuth();
  const mapRef = useRef<MapView>(null);

  // --- STATE MANAGEMENT ---
  const [allOffers, setAllOffers] = useState<Offer[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // Default Region
  const [region, setRegion] = useState<Region>({
    latitude: 41.0082,
    longitude: 28.9784,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  // --- DATA FETCHING ---
  const fetchData = async () => {
    try {
      const [offersRes, leaderboardRes] = await Promise.all([
        offersApi.getAll(user?.id || 0, region.latitude, region.longitude),
        client.get('/leaderboard')
      ]);

      // Sanitize coordinates to prevent map crashes
      const safeOffers = offersRes.data.map((o: any) => ({
        ...o,
        lat: parseFloat(o.lat),
        lng: parseFloat(o.lng),
        // Ensure type is safely lowercase to match our tab filters exactly
        type: strSafe(o.type)
      })).filter((o: any) => !isNaN(o.lat) && !isNaN(o.lng));

      setAllOffers(safeOffers);
      setLeaderboard(leaderboardRes.data);

    } catch (error) {
      console.error("Error fetching home screen data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Helper to ensure safe string casting
  const strSafe = (val: any) => (val ? String(val).toLowerCase().trim() : 'free');

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- FILTERING LOGIC (BUG FIXED) ---
  // Replaced the manual state override with a dynamic useMemo.
  // Now, even when refreshing, the app remembers the active tab and filters accordingly.
  const filteredOffers = useMemo(() => {
    if (activeFilter === 'all') return allOffers;
    return allOffers.filter(item => item.type === activeFilter);
  }, [allOffers, activeFilter]);

  const handleFilter = (type: FilterType) => {
    setActiveFilter(type);
  };

  // --- MAP ACTIONS ---
  const animateToLocation = (lat: number, lng: number) => {
    mapRef.current?.animateToRegion({
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    }, 700); 
  };

  const centerMap = () => {
    mapRef.current?.animateToRegion(region, 500);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  // --- CLAIM HANDLING ---
  const handleClaim = async (offerId: number, offerTitle: string) => {
    Alert.alert(
      t('claim_btn'), 
      `${t('confirm_claim')} "${offerTitle}"?`,
      [
        { text: t('cancel'), style: 'cancel' },
        { 
          text: t('confirm'), 
          style: 'default',
          onPress: async () => {
            try {
              const res = await offersApi.claim({
                user_id: user?.id || 0,
                offer_id: offerId
              });
              
              Alert.alert(
                t('success'),
                `${t('order_created')}\n\nCODE: ${res.data.qr_code}`,
                [{ text: t('close_btn'), onPress: () => fetchData() }]
              );
            } catch (error: any) {
              const msg = error.response?.data?.message || t('error');
              Alert.alert(t('error'), msg);
            }
          } 
        }
      ]
    );
  };

  // --- RENDERERS ---

  // 1. Map Markers (Clean & Typographic)
  const renderMarkers = () => {
    return filteredOffers.map((offer) => {
      const isFree = offer.type === 'free';
      const markerText = isFree ? 'F' : 'D'; 
      
      return (
        <Marker
          key={`m-${offer.id}`}
          coordinate={{ latitude: Number(offer.lat), longitude: Number(offer.lng) }}
          title={offer.restaurant}
          description={offer.description}
          onPress={() => animateToLocation(Number(offer.lat), Number(offer.lng))}
        >
          <View style={[styles.customMarker, isFree ? styles.borderSuccess : styles.borderWarning]}>
            <Text style={[styles.markerText, isFree ? styles.textSuccess : styles.textWarning]}>
              {markerText}
            </Text>
          </View>

          <Callout tooltip onPress={() => handleClaim(offer.id, offer.description)}>
            <View style={styles.calloutBubble}>
              <Text style={styles.calloutTitle}>{offer.restaurant}</Text>
              <Text style={styles.calloutDesc} numberOfLines={1}>{offer.description}</Text>
              <TouchableOpacity 
                style={[styles.calloutBtn, isFree ? styles.bgSuccess : styles.bgWarning]}
                activeOpacity={0.8}
              >
                <Text style={styles.calloutBtnText}>{t('claim_btn')} ➤</Text>
              </TouchableOpacity>
            </View>
          </Callout>
        </Marker>
      );
    });
  };

  // 2. Leaderboard Cards (Premium Gamification UI)
  const renderLeaderboardItem = ({ item, index }: { item: LeaderboardEntry, index: number }) => {
    const isTop3 = index < 3;
    const rankColors = ['#F59E0B', '#9CA3AF', '#D97706']; // Gold, Silver, Bronze from new theme
    const rankColor = isTop3 ? rankColors[index] : COLORS.textSub;

    return (
      <View style={[styles.lbCard, isTop3 && styles.lbCardHighlight]}>
        <Text style={[styles.lbRank, { color: rankColor }]}>#{index + 1}</Text>
        <Text style={styles.lbName} numberOfLines={1}>{item.restaurant}</Text>
        <View style={styles.lbStats}>
          <Text style={styles.lbPoints}>{item.points} PTS</Text>
          <Text style={styles.lbMeals}>{item.meals} {t('meals')}</Text>
        </View>
      </View>
    );
  };

  // 3. Offer Cards (List Item)
  const renderOfferCard = ({ item }: { item: Offer }) => {
    const isFree = item.type === 'free';
    const typeColor = isFree ? COLORS.success : COLORS.warning;
    const typeBgColor = isFree ? '#ECFDF5' : '#FEF3C7'; // Soft Emerald / Soft Amber

    return (
      <TouchableOpacity 
        style={styles.offerCard}
        activeOpacity={0.7}
        onPress={() => animateToLocation(Number(item.lat), Number(item.lng))}
      >
        <View style={[styles.cardIconBox, { backgroundColor: typeBgColor }]}>
          <Text style={[styles.cardIconLetter, { color: typeColor }]}>
             {item.restaurant.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={styles.cardInfo}>
          <View style={styles.cardHeaderRow}>
             <Text style={styles.cardTitle}>{item.restaurant}</Text>
             {item.distance !== undefined && (
               <Text style={styles.distText}>{item.distance} {t('dist_km')}</Text>
             )}
          </View>
          
          <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>

          <View style={styles.tagsRow}>
            <View style={[styles.tagBadge, { backgroundColor: typeBgColor }]}>
              <Text style={[styles.tagText, { color: typeColor }]}>
                {isFree ? t('free').toUpperCase() : `${item.discount_rate}% ${t('discount').toUpperCase()}`}
              </Text>
            </View>
            <Text style={styles.stockText}>{item.quantity} {t('left')}</Text>
          </View>
        </View>

        <View style={styles.cardAction}>
           <Button 
             title={t('claim_btn')} 
             onPress={() => handleClaim(item.id, item.description)} 
             style={styles.miniBtn}
             textStyle={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}
             variant={isFree ? 'success' : 'primary'}
           />
        </View>
      </TouchableOpacity>
    );
  };

  // Header Title generation
  const userFirstName = user?.name?.split(' ')[0] || '';
  const headerGreeting = `${t('hello')}, ${userFirstName}`;
  const userInitial = userFirstName.charAt(0).toUpperCase() || 'U';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* --- MAP SECTION --- */}
      <View style={styles.mapSection}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={region}
          showsUserLocation={true}
          showsMyLocationButton={false}
          customMapStyle={mapStyle} // Clean beige map theme
        >
          {renderMarkers()}
        </MapView>
        
        {/* Typographic Custom Location Button */}
        <TouchableOpacity 
          style={styles.myLocationBtn} 
          onPress={centerMap}
          activeOpacity={0.8}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.locationIcon}>⌖</Text>
        </TouchableOpacity>

        {/* HEADER OVERLAY */}
        <View style={styles.headerOverlay}>
          <Header 
             title={headerGreeting} 
             rightIcon={userInitial} 
             onRightPress={() => navigation.navigate('Profile')} 
             transparent 
           />
        </View>
      </View>

      {/* --- LIST SECTION (Bottom Sheet) --- */}
      <View style={styles.listContainer}>
        <View style={styles.handleBar} />

        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
            stickyHeaderIndices={[2]} 
          >
            
            {/* 1. LEADERBOARD */}
            {leaderboard.length > 0 && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>{t('top_restaurants')}</Text>
                <FlatList
                  data={leaderboard}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  renderItem={renderLeaderboardItem}
                  keyExtractor={(item, idx) => `lb-${idx}`}
                  contentContainerStyle={{ paddingHorizontal: 20 }}
                />
              </View>
            )}

            {/* 2. FILTERS (Clean typography & Soft Coral Active State) */}
            <View style={styles.filterContainer}>
              {(['all', 'free', 'discount'] as FilterType[]).map((tab) => (
                <TouchableOpacity 
                  key={tab}
                  style={[styles.filterBtn, activeFilter === tab && styles.filterBtnActive]} 
                  onPress={() => handleFilter(tab)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterText, activeFilter === tab && styles.filterTextActive]}>
                    {t(tab)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 3. OFFERS LIST */}
            <View style={styles.offersSection}>
              {filteredOffers.length === 0 ? (
                // Clean Empty State
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconCircle}>
                    <Text style={styles.emptyIconText}>!</Text>
                  </View>
                  <Text style={styles.emptyTitle}>{t('empty_list')}</Text>
                  <Button 
                    title={t('refresh')} 
                    onPress={fetchData} 
                    style={{ marginTop: 24, width: 160 }} 
                  />
                </View>
              ) : (
                filteredOffers.map((offer) => (
                   <React.Fragment key={`offer-frag-${offer.id}`}>
                      {renderOfferCard({ item: offer })}
                   </React.Fragment>
                ))
              )}
            </View>

          </ScrollView>
        )}
      </View>
    </View>
  );
};

// --- STYLES ---
const mapStyle = [
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  
  // Map Elements
  mapSection: { 
    height: height * MAP_HEIGHT_RATIO, 
    width: width,
    backgroundColor: '#EAECEF'
  },
  map: { ...StyleSheet.absoluteFillObject },
  headerOverlay: {
    position: 'absolute', top: Platform.OS === 'ios' ? 40 : 30, left: 0, right: 0, zIndex: 10
  },
  myLocationBtn: {
    position: 'absolute', bottom: 30, right: 20,
    backgroundColor: '#FFFFFF', width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
    ...SHADOWS.medium
  },
  locationIcon: { fontSize: 26, color: COLORS.textMain, fontWeight: '400', marginBottom: 2 },

  // Bottom Sheet List
  listContainer: {
    flex: 1, backgroundColor: COLORS.background,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    marginTop: -24, paddingTop: 12, overflow: 'hidden',
    ...SHADOWS.heavy // Adds depth separating map and list
  },
  handleBar: {
    width: 48, height: 5, backgroundColor: '#D1D5DB', borderRadius: 4, alignSelf: 'center', marginBottom: 16
  },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, color: COLORS.textSub, fontSize: 14, fontWeight: '600' },

  // Leaderboard
  sectionContainer: { marginBottom: 24, marginTop: 4 },
  sectionTitle: { 
    fontSize: 16, fontWeight: '900', color: COLORS.textMain, 
    marginLeft: 24, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5
  },
  lbCard: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16, paddingHorizontal: 12,
    borderRadius: 16, marginRight: 16,
    width: 130, alignItems: 'center',
    borderWidth: 1, borderColor: '#F3F4F6',
    ...SHADOWS.light
  },
  lbCardHighlight: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' },
  lbRank: { fontSize: 24, fontWeight: '900', marginBottom: 6 },
  lbName: { fontSize: 14, fontWeight: '800', color: COLORS.textMain, textAlign: 'center', marginBottom: 6, letterSpacing: -0.3 },
  lbStats: { alignItems: 'center' },
  lbPoints: { fontSize: 11, color: COLORS.primary, fontWeight: '900', letterSpacing: 0.5 },
  lbMeals: { fontSize: 10, color: COLORS.textSub, marginTop: 2, fontWeight: '600' },

  // Filters
  filterContainer: {
    flexDirection: 'row', paddingHorizontal: 24, paddingBottom: 16,
    backgroundColor: COLORS.background, gap: 12
  },
  filterBtn: {
    paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: 12, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E5E7EB',
    ...SHADOWS.light
  },
  filterBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 12, color: COLORS.textSub, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  filterTextActive: { color: '#FFFFFF' },

  // Offers List
  offersSection: { paddingBottom: 24 },
  offerCard: {
    flexDirection: 'row', backgroundColor: '#FFFFFF',
    borderRadius: 20, padding: 16, marginHorizontal: 24, marginBottom: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6', ...SHADOWS.light
  },
  cardIconBox: {
    width: 52, height: 52, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', marginRight: 16
  },
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
  emptyIconCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16
  },
  emptyIconText: { fontSize: 28, fontWeight: '900', color: '#D1D5DB' },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textSub, textAlign: 'center' },

  // Custom Map Markers & Callout
  customMarker: {
    backgroundColor: '#FFFFFF', padding: 6, borderRadius: 20,
    borderWidth: 3, ...SHADOWS.medium,
    width: 32, height: 32, justifyContent: 'center', alignItems: 'center'
  },
  markerText: { fontSize: 14, fontWeight: '900' },
  borderSuccess: { borderColor: COLORS.success },
  borderWarning: { borderColor: COLORS.warning },
  
  calloutBubble: {
    backgroundColor: '#FFFFFF', padding: 12, borderRadius: 16,
    width: 160, alignItems: 'center', ...SHADOWS.medium
  },
  calloutTitle: { fontWeight: '900', fontSize: 13, marginBottom: 4, color: COLORS.textMain },
  calloutDesc: { fontSize: 11, color: COLORS.textSub, marginBottom: 10, fontWeight: '500' },
  calloutBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  calloutBtnText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  // Color Helpers
  bgSuccess: { backgroundColor: COLORS.success },
  bgWarning: { backgroundColor: COLORS.warning },
  textSuccess: { color: COLORS.success },
  textWarning: { color: COLORS.warning }
});

export default HomeScreen;