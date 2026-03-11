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
  ScrollView,
  PermissionsAndroid,
  Modal, 
  TouchableWithoutFeedback
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE, Region } from 'react-native-maps';
// Import the officially supported community geolocation package
import Geolocation from '@react-native-community/geolocation';
import QRCode from 'react-native-qrcode-svg';

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
  
  // State to hold the QR code string after a successful claim
  const [claimedQr, setClaimedQr] = useState<string | null>(null);

  // We set the default region to Budapest (Project Theme) instead of Istanbul
  // This acts as a fallback if the user denies GPS permissions
  const [region, setRegion] = useState<Region>({
    latitude: 47.4979, 
    longitude: 19.0402,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  // Keep track of the actual user GPS location to send to the backend
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  // --- LOCATION PERMISSIONS & ACQUISITION ---
  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'ios') {
      const auth = await Geolocation.requestAuthorization('whenInUse');
      return auth === 'granted';
    }

    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: "Location Permission",
            message: "We need your location to show the distance to nearby food offers.",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK"
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn("Permission request error:", err);
        return false;
      }
    }
    return false;
  };

  const getCurrentLocation = async () => {
    let hasHandledLocation = false;

    // FIX: Failsafe Timeout
    // If the geolocation takes more than 3 seconds (e.g. permission dialog stuck, GPS off),
    // we force the data fetch using the default region so the user is not stuck on "Loading..."
    const failsafeTimeout = setTimeout(() => {
      if (!hasHandledLocation) {
        console.warn("Geolocation timed out or stuck. Falling back to default region.");
        hasHandledLocation = true;
        fetchData(region.latitude, region.longitude);
      }
    }, 3000);

    try {
      const hasPermission = await requestLocationPermission();

      if (!hasPermission) {
        if (!hasHandledLocation) {
          hasHandledLocation = true;
          clearTimeout(failsafeTimeout);
          fetchData(region.latitude, region.longitude);
        }
        return;
      }

      Geolocation.getCurrentPosition(
        (position) => {
          if (!hasHandledLocation) {
            hasHandledLocation = true;
            clearTimeout(failsafeTimeout);
            const { latitude, longitude } = position.coords;
            setUserLocation({ lat: latitude, lng: longitude });
            setRegion(prev => ({ ...prev, latitude, longitude }));
            fetchData(latitude, longitude);
          }
        },
        (error) => {
          console.warn("Geolocation Warning:", error.message);
          if (!hasHandledLocation) {
            hasHandledLocation = true;
            clearTimeout(failsafeTimeout);
            fetchData(region.latitude, region.longitude);
          }
        },
        // Using low accuracy to speed up response time on emulators and weak signals
        { enableHighAccuracy: false, timeout: 2500, maximumAge: 3600000 }
      );
    } catch (err) {
      if (!hasHandledLocation) {
        hasHandledLocation = true;
        clearTimeout(failsafeTimeout);
        fetchData(region.latitude, region.longitude);
      }
    }
  };

  // --- DATA FETCHING ---
  // Modified to accept dynamic coordinates from GPS
  const fetchData = async (currentLat: number, currentLng: number) => {
    try {
      // Ensure we start loading if fetching manually
      setLoading(true);

      const [offersRes, leaderboardRes] = await Promise.all([
        offersApi.getAll(user?.id || 0, currentLat, currentLng),
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
      // THIS is the crucial part that stops the spinner
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Helper to ensure safe string casting
  const strSafe = (val: any) => (val ? String(val).toLowerCase().trim() : 'free');

  useEffect(() => {
    // FIX: Delay location request slightly to prevent clashing with App.tsx Notification permission
    const startUpTimeout = setTimeout(() => {
      getCurrentLocation();
    }, 500);

    return () => clearTimeout(startUpTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- FILTERING LOGIC ---
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
    // Refresh using the latest known user location, or fallback to region
    if (userLocation) {
      fetchData(userLocation.lat, userLocation.lng);
    } else {
      getCurrentLocation();
    }
  }, [userLocation]);

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
              
              // Show the QR modal instead of a standard alert
              setClaimedQr(res.data.qr_code);
              
              // Refresh data after successful claim using current location
              if (userLocation) {
                fetchData(userLocation.lat, userLocation.lng);
              } else {
                fetchData(region.latitude, region.longitude);
              }
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
             {/* Displays the dynamic distance calculated directly by the PostGIS backend */}
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
          // Using region directly ensures the map always reflects our state
          region={region}
          showsUserLocation={false}
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
                    onPress={onRefresh} 
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

      {/* --- SUCCESS QR MODAL --- */}
      <Modal
        visible={!!claimedQr}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setClaimedQr(null)}
      >
        <TouchableWithoutFeedback onPress={() => setClaimedQr(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalCard}>
                
                <Text style={styles.modalTitleSuccess}>
                  {t('success')}!
                </Text>
                
                <Text style={styles.modalInfoText}>
                  {t('order_created')}
                </Text>

                <View style={styles.qrCodeWrapper}>
                  {claimedQr && (
                    <QRCode
                      value={claimedQr} 
                      size={200}
                      color="black"
                      backgroundColor="transparent"
                    />
                  )}
                </View>

                <Button 
                  title={t('close_btn')} 
                  onPress={() => setClaimedQr(null)} 
                  style={{ width: '100%' }} 
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

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
  textWarning: { color: COLORS.warning },

  // Modal Specific Styles
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.6)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 24 
  },
  modalCard: { 
    width: '100%', 
    backgroundColor: '#FFFFFF', 
    borderRadius: 24, 
    padding: 32, 
    alignItems: 'center',
    ...SHADOWS.heavy
  },
  modalTitleSuccess: { 
    fontSize: 20, 
    fontWeight: '900', 
    color: COLORS.primary, 
    marginBottom: 16 
  },
  modalInfoText: { 
    fontSize: 14, 
    color: COLORS.textSub, 
    textAlign: 'center', 
    marginBottom: 24,
    fontWeight: '500'
  },
  qrCodeWrapper: { 
    padding: 20, 
    backgroundColor: '#F8F9FA', 
    borderRadius: 20, 
    marginBottom: 24 
  }
});

export default HomeScreen;