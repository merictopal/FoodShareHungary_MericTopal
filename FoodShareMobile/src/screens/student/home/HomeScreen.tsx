import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, StatusBar, Platform, ActivityIndicator, RefreshControl, ScrollView, PermissionsAndroid } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';

import { useAuth } from '../../../context/AuthContext';
import { offersApi } from '../../../api/offers';
import { client } from '../../../api/client';
import { COLORS } from '../../../constants/theme';
import { Header } from '../../../components/Header';
import { Button } from '../../../components/Button';

// Refactored Components & Styles
import { styles, mapStyle } from './styles';
import { OfferCard } from './components/OfferCard';
import { RecommendedCard } from './components/RecommendedCard';
import { LeaderboardCard } from './components/LeaderboardCard';
import { MapMarkerItem } from './components/MapMarkerItem';
import { SuccessQrModal } from './components/SuccessQrModal';

// --- TYPES EXPORTED FOR COMPONENTS ---
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
  image_url?: string; 
  is_recommended?: boolean; 
}

export interface LeaderboardEntry {
  restaurant: string;
  points: number;
  meals: number;
}

type FilterType = 'all' | 'free' | 'discount';

const HomeScreen = ({ navigation }: any) => {
  const { user, t } = useAuth();
  const mapRef = useRef<MapView>(null);

  const [allOffers, setAllOffers] = useState<Offer[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [recommendedOffers, setRecommendedOffers] = useState<Offer[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [claimedQr, setClaimedQr] = useState<string | null>(null);

  const [region, setRegion] = useState<Region>({ latitude: 47.4979, longitude: 19.0402, latitudeDelta: 0.0922, longitudeDelta: 0.0421 });
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'ios') return await Geolocation.requestAuthorization('whenInUse') === 'granted';
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, { title: "Location Permission", message: "We need your location to show the distance to nearby food offers.", buttonNeutral: "Ask Me Later", buttonNegative: "Cancel", buttonPositive: "OK" });
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) { return false; }
    }
    return false;
  };

  const getCurrentLocation = async () => {
    let hasHandledLocation = false;
    const failsafeTimeout = setTimeout(() => {
      if (!hasHandledLocation) { hasHandledLocation = true; fetchData(region.latitude, region.longitude); }
    }, 3000);

    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        if (!hasHandledLocation) { hasHandledLocation = true; clearTimeout(failsafeTimeout); fetchData(region.latitude, region.longitude); }
        return;
      }
      Geolocation.getCurrentPosition(
        (position) => {
          if (!hasHandledLocation) {
            hasHandledLocation = true; clearTimeout(failsafeTimeout);
            const { latitude, longitude } = position.coords;
            setUserLocation({ lat: latitude, lng: longitude });
            setRegion(prev => ({ ...prev, latitude, longitude }));
            fetchData(latitude, longitude);
          }
        },
        () => {
          if (!hasHandledLocation) { hasHandledLocation = true; clearTimeout(failsafeTimeout); fetchData(region.latitude, region.longitude); }
        },
        { enableHighAccuracy: false, timeout: 2500, maximumAge: 3600000 }
      );
    } catch (err) {
      if (!hasHandledLocation) { hasHandledLocation = true; clearTimeout(failsafeTimeout); fetchData(region.latitude, region.longitude); }
    }
  };

  const fetchData = async (currentLat: number, currentLng: number) => {
    try {
      setLoading(true);
      const [offersRes, leaderboardRes, recommendedRes] = await Promise.all([
        offersApi.getAll(user?.id || 0, currentLat, currentLng),
        client.get('/leaderboard'),
        client.get(`/recommendations/${user?.id || 0}?lat=${currentLat}&lng=${currentLng}`).catch(() => ({ data: [] }))
      ]);

      const safeOffers = offersRes.data.map((o: any) => ({ ...o, lat: parseFloat(o.lat), lng: parseFloat(o.lng), type: strSafe(o.type), image_url: o.image_url })).filter((o: any) => !isNaN(o.lat) && !isNaN(o.lng));
      const safeRecommended = (recommendedRes.data || []).map((o: any) => ({ ...o, lat: parseFloat(o.lat), lng: parseFloat(o.lng), type: strSafe(o.type), image_url: o.image_url, is_recommended: true })).filter((o: any) => !isNaN(o.lat) && !isNaN(o.lng));

      setAllOffers(safeOffers);
      setLeaderboard(leaderboardRes.data);
      setRecommendedOffers(safeRecommended);
    } catch (error) {
      console.error("Error fetching home screen data:", error);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  };

  const strSafe = (val: any) => (val ? String(val).toLowerCase().trim() : 'free');

  useEffect(() => {
    const startUpTimeout = setTimeout(() => { getCurrentLocation(); }, 500);
    return () => clearTimeout(startUpTimeout);
  }, []);

  const filteredOffers = useMemo(() => {
    if (activeFilter === 'all') return allOffers;
    return allOffers.filter(item => item.type === activeFilter);
  }, [allOffers, activeFilter]);

  const animateToLocation = (lat: number, lng: number) => {
    mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 700); 
  };

  const centerMap = () => { mapRef.current?.animateToRegion(region, 500); };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (userLocation) fetchData(userLocation.lat, userLocation.lng);
    else getCurrentLocation();
  }, [userLocation]);

  const handleClaim = async (offerId: number, offerTitle: string) => {
    if (user?.verification_status !== 'verified') {
      return Alert.alert(t('error') || "Verification Required", "You need to upload your student ID to claim meals.", [
        { text: t('cancel') || "Cancel", style: "cancel" }, { text: "Go to Profile", onPress: () => navigation.navigate('Profile') }
      ]);
    }
    Alert.alert(t('claim_btn'), `${t('confirm_claim')} "${offerTitle}"?`, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('confirm'), style: 'default', onPress: async () => {
          try {
            const res = await offersApi.claim({ user_id: user?.id || 0, offer_id: offerId });
            setClaimedQr(res.data.qr_code);
            userLocation ? fetchData(userLocation.lat, userLocation.lng) : fetchData(region.latitude, region.longitude);
          } catch (error: any) {
            Alert.alert(t('error'), error.response?.data?.message || t('error'));
          }
        } 
      }
    ]);
  };

  const userFirstName = user?.name?.split(' ')[0] || '';
  const headerGreeting = `${t('hello')}, ${userFirstName}`;
  const userInitial = userFirstName.charAt(0).toUpperCase() || 'U';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View style={styles.mapSection}>
        <MapView ref={mapRef} provider={PROVIDER_GOOGLE} style={styles.map} initialRegion={region} region={region} showsUserLocation={false} showsMyLocationButton={false} customMapStyle={mapStyle}>
          {filteredOffers.map((offer) => (
            <MapMarkerItem key={`m-${offer.id}`} offer={offer} onPressMap={animateToLocation} onClaim={handleClaim} t={t} />
          ))}
        </MapView>
        <TouchableOpacity style={styles.myLocationBtn} onPress={centerMap} activeOpacity={0.8} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Text style={styles.locationIcon}>⌖</Text></TouchableOpacity>
        <View style={styles.headerOverlay}>
          <Header title={headerGreeting} rightIcon={userInitial} onRightPress={() => navigation.navigate('Profile')} transparent />
        </View>
      </View>

      <View style={styles.listContainer}>
        <View style={styles.handleBar} />
        {loading ? (
          <View style={styles.centerContent}><ActivityIndicator size="large" color={COLORS.primary} /><Text style={styles.loadingText}>Loading...</Text></View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />} stickyHeaderIndices={[3]}>
            
            {leaderboard.length > 0 && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>{t('top_restaurants')}</Text>
                <FlatList data={leaderboard} horizontal showsHorizontalScrollIndicator={false} renderItem={({item, index}) => <LeaderboardCard item={item} index={index} t={t} />} keyExtractor={(item, idx) => `lb-${idx}`} contentContainerStyle={{ paddingHorizontal: 20 }} />
              </View>
            )}

            {recommendedOffers.length > 0 && (
              <View style={styles.sectionContainer}>
                <Text style={[styles.sectionTitle, { color: COLORS.primary }]}>✨ {t('recommended')}</Text>
                <FlatList data={recommendedOffers} horizontal showsHorizontalScrollIndicator={false} renderItem={({item}) => <RecommendedCard item={item} onPressMap={animateToLocation} onClaim={handleClaim} t={t} />} keyExtractor={(item) => `ai-${item.id}`} contentContainerStyle={{ paddingHorizontal: 20 }} />
              </View>
            )}

            <View style={styles.filterContainer}>
              {(['all', 'free', 'discount'] as FilterType[]).map((tab) => (
                <TouchableOpacity key={tab} style={[styles.filterBtn, activeFilter === tab && styles.filterBtnActive]} onPress={() => setActiveFilter(tab)} activeOpacity={0.7}><Text style={[styles.filterText, activeFilter === tab && styles.filterTextActive]}>{t(tab)}</Text></TouchableOpacity>
              ))}
            </View>

            <View style={styles.offersSection}>
              {filteredOffers.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconCircle}><Text style={styles.emptyIconText}>!</Text></View>
                  <Text style={styles.emptyTitle}>{t('empty_list')}</Text>
                  <Button title={t('refresh')} onPress={onRefresh} style={{ marginTop: 24, width: 160 }} />
                </View>
              ) : (
                filteredOffers.map((offer) => (
                  <OfferCard key={`offer-frag-${offer.id}`} item={offer} onPressMap={animateToLocation} onClaim={handleClaim} t={t} />
                ))
              )}
            </View>

          </ScrollView>
        )}
      </View>

      <SuccessQrModal visible={!!claimedQr} onClose={() => setClaimedQr(null)} qrCode={claimedQr} t={t} />
    </View>
  );
};

export default HomeScreen;