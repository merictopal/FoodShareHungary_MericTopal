import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';

import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StatusBar,
  Platform,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  PermissionsAndroid,
  AppState,
} from 'react-native';

import MapView, {
  PROVIDER_GOOGLE,
  Region,
} from 'react-native-maps';

import Geolocation from '@react-native-community/geolocation';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '../../../context/AuthContext';
import { offersApi } from '../../../api/offers';
import { client } from '../../../api/client';
import { COLORS } from '../../../constants/theme';

import { EmptyState } from '../../../components/EmptyState';
import { toLangUpper } from '../../../utils/text';
import { apiErrorKey } from '../../../utils/apiErrors';

import { styles, mapStyle, SHEET_OVERLAP } from './styles';

import { OfferCard } from './components/OfferCard';
import { RecommendedCard } from './components/RecommendedCard';
import { LeaderboardCard } from './components/LeaderboardCard';
import { MapMarkerItem } from './components/MapMarkerItem';
import { SuccessQrModal } from './components/SuccessQrModal';
import { RestaurantInfoCard } from './components/RestaurantInfoCard';
import {
  distanceKm,
  FALLBACK_MAP_CENTER,
  groupOffersByRestaurant,
  LOCATION_REFRESH_OPTIONS,
  LOCATION_REFRESH_RETRY_OPTIONS,
  locationQuery,
  movedSignificantly,
  requestPositionWithRetry,
} from './utils';
import type { LatLng, RestaurantGroup } from './utils';

export interface Offer {
  id: number;
  restaurant: string;
  // Pickup location (GET /api/offers); address may be NULL
  restaurant_id?: number;
  address?: string | null;
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
  const { user, t, lang, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  // Location timers/callbacks may fire after this screen unmounts (e.g. logout or session
  // expiry during startup); they must not trigger API requests then.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [allOffers, setAllOffers] = useState<Offer[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [recommendedOffers, setRecommendedOffers] = useState<Offer[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // True after the first offers request finished; from then on refreshes keep the list mounted
  const [hasLoadedOffers, setHasLoadedOffers] = useState(false);
  // True when the latest offers request failed (429, network, 5xx...). A failure must not
  // look like a legitimate empty result, and must not clear offers that are already shown.
  const [offersError, setOffersError] = useState(false);

  const [activeFilter, setActiveFilter] =
    useState<FilterType>('all');

  const [claimedQr, setClaimedQr] =
    useState<string | null>(null);

  // Pickup restaurant of the last successful claim, shown in the QR modal
  const [claimedPickup, setClaimedPickup] =
    useState<RestaurantGroup | null>(null);

  // Height of the translucent header drawn over the top of the map (measured; depends on the safe-area inset)
  const [headerHeight, setHeaderHeight] =
    useState(0);

  // react-native-maps 1.27 (Android) crashes if mapPadding is applied before the GoogleMap exists
  // (NPE in GoogleMap.setPadding), so the padding is only passed after onMapReady.
  const [mapReady, setMapReady] =
    useState(false);

  // Restaurant whose marker was pressed (key from groupOffersByRestaurant)
  const [selectedRestaurantKey, setSelectedRestaurantKey] =
    useState<string | null>(null);

  // Starts on the fallback map view until the device returns a real position (see FALLBACK_MAP_CENTER)
  const [region, setRegion] = useState<Region>({
    ...FALLBACK_MAP_CENTER,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  // Latest real device position; null while unknown (the map fallback is never stored here)
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);

  /*
   * ---------------------------------------------------------
   * DISTANCE
   * ---------------------------------------------------------
   */

  const calculateDistanceKm = distanceKm;

  /*
   * ---------------------------------------------------------
   * HELPERS
   * ---------------------------------------------------------
   */

  const strSafe = useCallback(
    (value: any): 'free' | 'discount' => {
      const valueString = value
        ? String(value).toLowerCase().trim()
        : 'free';

      return valueString === 'discount'
        ? 'discount'
        : 'free';
    },
    []
  );

  const normalizeOffer = useCallback(
    (
      rawOffer: any,
      location: LatLng | null,
      recommended = false
    ): Offer | null => {
      const lat = Number.parseFloat(rawOffer?.lat);
      const lng = Number.parseFloat(rawOffer?.lng);

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        return null;
      }

      /*
       * Calculate distance ONCE and round it to
       * exactly two decimal places.
       *
       * This same value is used for:
       * - Active Offers
       * - Recommended For You
       */

      // No device position -> no distance (never measured from the map fallback)
      const distance = location
        ? Number(calculateDistanceKm(location.lat, location.lng, lat, lng).toFixed(2))
        : undefined;

      return {
        ...rawOffer,

        id: Number(rawOffer.id),

        restaurant:
          rawOffer.restaurant ||
          rawOffer.restaurant_name ||
          'Restaurant',

        restaurant_id:
          rawOffer.restaurant_id !== undefined && rawOffer.restaurant_id !== null
            ? Number(rawOffer.restaurant_id)
            : undefined,

        address: rawOffer.address ?? null,

        type: strSafe(rawOffer.type),

        description:
          rawOffer.description || '',

        quantity:
          Number(rawOffer.quantity) || 0,

        discount_rate:
          Number(rawOffer.discount_rate) || 0,

        lat,
        lng,

        distance,

        image_url: rawOffer.image_url,

        is_recommended: recommended,
      };
    },
    [calculateDistanceKm, strSafe]
  );

  /*
   * ---------------------------------------------------------
   * LOCATION PERMISSION
   * ---------------------------------------------------------
   */

  const requestLocationPermission =
    async (): Promise<boolean> => {
      if (Platform.OS === 'ios') {
        const result =
          await Geolocation.requestAuthorization(
            'whenInUse'
          );

        return result === 'granted';
      }

      if (Platform.OS === 'android') {
        try {
          const granted =
            await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
              {
                title: t('location_permission_title'),
                message: t('location_permission_msg'),
                buttonNeutral: t('ask_me_later'),
                buttonNegative: t('cancel'),
                buttonPositive: t('ok'),
              }
            );

          return (
            granted ===
            PermissionsAndroid.RESULTS.GRANTED
          );
        } catch {
          return false;
        }
      }

      return false;
    };

  /*
   * ---------------------------------------------------------
   * FETCH DATA
   * ---------------------------------------------------------
   */

  // Latest real device position (null until a fix arrives; fallback coordinates are never stored here)
  const locationFixRef = useRef<{ lat: number; lng: number } | null>(null);
  // Mirrors hasLoadedOffers for listeners that must not re-subscribe on every change
  const hasLoadedOffersRef = useRef(false);

  // Distances are computed on the device from each offer's coordinates (same formula as normalizeOffer)
  const withDistances = useCallback(
    (list: Offer[], lat: number, lng: number): Offer[] =>
      list.map(offer => ({
        ...offer,
        distance: Number(
          calculateDistanceKm(lat, lng, Number(offer.lat), Number(offer.lng)).toFixed(2)
        ),
      })),
    [calculateDistanceKm]
  );

  const sortByDistance = useCallback(
    (list: Offer[]): Offer[] =>
      [...list].sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0)),
    []
  );

  // One Home load at a time: a call made while a load is running (foreground, pull-to-refresh,
  // after a claim) is coalesced into a single follow-up load with the latest coordinates.
  const fetchInFlightRef = useRef(false);
  const pendingFetchRef = useRef<{ location: LatLng | null } | null>(null);

  // `location` is the real device position, or null when it is unknown: then no coordinates are sent,
  // so the backend neither shows distances nor ranks recommendations by proximity.
  const fetchData = useCallback(
    async (location: LatLng | null) => {
      if (!isMountedRef.current) {
        return;
      }

      if (fetchInFlightRef.current) {
        pendingFetchRef.current = { location };
        return;
      }
      fetchInFlightRef.current = true;

      try {
        setLoading(true);

        const [
          offersRes,
          recommendedRes,
        ] = await Promise.all([
          offersApi.getAll(
            user?.id || 0,
            location
          ),

          client
            .get(
              `/recommendations/${
                user?.id || 0
              }?${locationQuery(location)}`
            )
            .catch(() => ({
              data: [],
            })),
        ]);

        /*
         * -----------------------------------------------------
         * ACTIVE OFFERS
         * -----------------------------------------------------
         */

        const rawOffers = Array.isArray(
          offersRes?.data
        )
          ? offersRes.data
          : [];

        const safeOffers = rawOffers
          .map((offer: any) =>
            normalizeOffer(
              offer,
              location,
              false
            )
          )
          .filter(
            (
              offer: Offer | null
            ): offer is Offer =>
              offer !== null
          );

        /*
         * -----------------------------------------------------
         * RECOMMENDED OFFERS
         * -----------------------------------------------------
         */

        const rawRecommended =
          Array.isArray(
            recommendedRes?.data
          )
            ? recommendedRes.data
            : [];

        const safeRecommended =
          rawRecommended
            .map((offer: any) =>
              normalizeOffer(
                offer,
                location,
                true
              )
            )
            .filter(
              (
                offer: Offer | null
              ): offer is Offer =>
                offer !== null
            );

        // A real location fix may have arrived while this (fallback) request was running:
        // show distances from the fix and order by them, without another request.
        const fix = locationFixRef.current;
        const fixDiffers =
          fix !== null &&
          (location === null || fix.lat !== location.lat || fix.lng !== location.lng);

        setAllOffers(
          fixDiffers
            ? sortByDistance(withDistances(safeOffers, fix.lat, fix.lng))
            : safeOffers
        );

        setRecommendedOffers(
          fixDiffers
            ? withDistances(safeRecommended, fix.lat, fix.lng)
            : safeRecommended
        );

        setOffersError(false);
      } catch (error: any) {
        // warn (not error): the offers error state is shown in the UI; no full-screen dev overlay
        console.warn(
          'Home data fetch failed:',
          error?.response?.status ?? error?.message
        );

        setOffersError(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setHasLoadedOffers(true);
        hasLoadedOffersRef.current = true;
        fetchInFlightRef.current = false;

        const pending = pendingFetchRef.current;
        pendingFetchRef.current = null;
        if (pending && isMountedRef.current) {
          fetchDataRef.current(pending.location);
        }
      }
    },
    [normalizeOffer, user?.id, withDistances, sortByDistance]
  );
  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;

  /*
   * ---------------------------------------------------------
   * LEADERBOARD
   * ---------------------------------------------------------
   */

  // /leaderboard takes no coordinates, so it is requested right away instead of waiting
  // for the location bootstrap that the offer/recommendation requests depend on.
  const fetchLeaderboard = useCallback(async () => {
    if (!isMountedRef.current) {
      return;
    }

    try {
      const leaderboardRes = await client.get('/leaderboard');

      if (!isMountedRef.current) {
        return;
      }

      setLeaderboard(
        Array.isArray(leaderboardRes?.data)
          ? leaderboardRes.data
          : []
      );
    } catch (error: any) {
      console.warn('Leaderboard fetch failed:', error?.response?.status ?? error?.message);
    }
  }, []);

  /*
   * ---------------------------------------------------------
   * CURRENT LOCATION
   * ---------------------------------------------------------
   */

  // Stores a real device position and updates what is already shown (map centre, distances,
  // order) on the device; no new request, the offers themselves don't depend on the position.
  const applyLocationFix = useCallback(
    (latitude: number, longitude: number) => {
      if (!isMountedRef.current) {
        return;
      }

      locationFixRef.current = { lat: latitude, lng: longitude };

      setUserLocation({ lat: latitude, lng: longitude });

      setRegion(previous => ({
        ...previous,
        latitude,
        longitude,
      }));

      setAllOffers(previous =>
        sortByDistance(withDistances(previous, latitude, longitude))
      );

      setRecommendedOffers(previous =>
        withDistances(previous, latitude, longitude)
      );
    },
    [withDistances, sortByDistance]
  );

  const getCurrentLocation = useCallback(
    async () => {
      let hasHandledLocation = false;

      // Loads exactly once per bootstrap: with a real fix, or WITHOUT a position once both the
      // first attempt and its one retry failed (or permission was denied). The map keeps its fallback view.
      const loadWithFallback = () => {
        if (!hasHandledLocation) {
          hasHandledLocation = true;

          fetchData(null);
        }
      };

      try {
        const hasPermission =
          await requestLocationPermission();

        if (!hasPermission) {
          loadWithFallback();
          return;
        }

        // Started only after the permission answer: the first-run dialog can stay open longer
        // than the location timeouts.
        requestPositionWithRetry(
          Geolocation.getCurrentPosition,
          (latitude, longitude) => {
            if (hasHandledLocation) {
              // Late fix after the position-less load: show it and reload, so recommendations
              // are ranked with the real position too
              applyLocationFix(latitude, longitude);
              fetchData({ lat: latitude, lng: longitude });
              return;
            }

            hasHandledLocation = true;

            applyLocationFix(latitude, longitude);

            fetchData({ lat: latitude, lng: longitude });
          },
          loadWithFallback
        );
      } catch {
        loadWithFallback();
      }
    },
    [
      fetchData,
      applyLocationFix,
    ]
  );

  // Refresh / return to the foreground: the lists are reloaded right away with the last known real
  // position (or none) and, only if permission is already granted (checked without a dialog), the CURRENT
  // position is requested in the background. If the device moved (or had no fix yet) the lists reload with it.
  const tryLocationInBackground = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return;
    }

    try {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );

      if (!granted) {
        return;
      }

      requestPositionWithRetry(
        Geolocation.getCurrentPosition,
        (latitude, longitude) => {
          const next = { lat: latitude, lng: longitude };
          const moved = movedSignificantly(locationFixRef.current, next);
          applyLocationFix(latitude, longitude);
          if (moved) {
            fetchDataRef.current(next);
          }
        },
        () => {},
        LOCATION_REFRESH_OPTIONS,
        LOCATION_REFRESH_RETRY_OPTIONS
      );
    } catch {
      // No fix: the last known position (or none) stays in use
    }
  }, [applyLocationFix]);

  /*
   * ---------------------------------------------------------
   * INITIAL LOAD
   * ---------------------------------------------------------
   */

  // Runs once per mount. getCurrentLocation's identity changes when a location fix updates
  // `region`; depending on it re-ran the whole bootstrap (second permission request, second
  // position request and a second fetchData). The ref still calls the current function.
  const getCurrentLocationRef = useRef(getCurrentLocation);
  getCurrentLocationRef.current = getCurrentLocation;

  useEffect(() => {
    fetchLeaderboard();

    const startupTimeout =
      setTimeout(() => {
        getCurrentLocationRef.current();
      }, 500);

    return () =>
      clearTimeout(startupTimeout);
  }, [fetchLeaderboard]);

  /*
   * ---------------------------------------------------------
   * FILTER
   * ---------------------------------------------------------
   */

  const filteredOffers = useMemo(() => {
    if (activeFilter === 'all') {
      return allOffers;
    }

    return allOffers.filter(
      item => item.type === activeFilter
    );
  }, [allOffers, activeFilter]);

  // One marker per restaurant. The selected card closes by itself if a refresh removes its last offer.
  const restaurantGroups = useMemo(
    () => groupOffersByRestaurant(filteredOffers),
    [filteredOffers]
  );

  const selectedRestaurant = useMemo(
    () => restaurantGroups.find(g => g.key === selectedRestaurantKey) || null,
    [restaurantGroups, selectedRestaurantKey]
  );

  // Latest offers for the claim pickup snapshot: the claimed offer may vanish on the post-claim refresh
  const offersSnapshotRef = useRef<Offer[]>([]);
  offersSnapshotRef.current = [...allOffers, ...recommendedOffers];

  /*
   * ---------------------------------------------------------
   * MAP
   * ---------------------------------------------------------
   */

  // Stable identity so the memoized markers/cards don't re-render on every Home render
  const animateToLocation = useCallback((
    lat: number,
    lng: number
  ) => {
    mapRef.current?.animateToRegion(
      {
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      },
      700
    );
  }, []);

  const centerMap = () => {
    mapRef.current?.animateToRegion(
      region,
      500
    );
  };

  /*
   * ---------------------------------------------------------
   * REFRESH
   * ---------------------------------------------------------
   */

  const onRefresh = useCallback(() => {
    // The list is visible early (leaderboard first); a pull during the initial location
    // bootstrap would start a second bootstrap, so it waits for the first offers load.
    if (!hasLoadedOffers) {
      return;
    }

    setRefreshing(true);
    fetchLeaderboard();

    // No re-prompt and no wait for the location timeout: the startup bootstrap already asked
    fetchData(userLocation);
    tryLocationInBackground();
  }, [
    hasLoadedOffers,
    userLocation,
    fetchData,
    fetchLeaderboard,
    tryLocationInBackground,
  ]);

  /*
   * ---------------------------------------------------------
   * FOREGROUND / FOCUS REFRESH
   * ---------------------------------------------------------
   */

  // Quiet reload of what is shown (no full-screen loader once data exists)
  const refreshQuietly = useCallback(() => {
    fetchLeaderboard();

    fetchData(locationFixRef.current);
    tryLocationInBackground();
  }, [fetchData, fetchLeaderboard, tryLocationInBackground]);

  const refreshQuietlyRef = useRef(refreshQuietly);
  refreshQuietlyRef.current = refreshQuietly;

  // Offers can change while the app is in the background. Only a real background -> active
  // return counts, and only after the first load: the location permission dialog also sends the
  // app to the background during startup, and that must not cause a second startup load.
  const isHomeStaleRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (
        previousState !== 'background' ||
        nextState !== 'active' ||
        !hasLoadedOffersRef.current
      ) {
        return;
      }

      if (navigation.isFocused()) {
        refreshQuietlyRef.current();
      } else {
        // Another tab is open: reload once when Home is shown again
        isHomeStaleRef.current = true;
      }
    });

    return () => subscription.remove();
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      if (isHomeStaleRef.current) {
        isHomeStaleRef.current = false;
        refreshQuietlyRef.current();
      }
    }, [])
  );

  /*
   * ---------------------------------------------------------
   * CLAIM
   * ---------------------------------------------------------
   */

  const handleClaim = useCallback(async (
    offerId: number,
    offerTitle: string
  ) => {
    // The stored status may predate an admin approval: re-read it before blocking the claim.
    // (The backend enforces verification on /offers/claim regardless.)
    const verificationStatus =
      user?.verification_status === 'verified'
        ? 'verified'
        : (await refreshUser())?.verification_status;

    if (
      verificationStatus !==
      'verified'
    ) {
      Alert.alert(
        t('verification_required_title'),
        t('verification_required_msg'),
        [
          {
            text: t('cancel'),
            style: 'cancel',
          },
          {
            text: t('go_to_profile'),
            onPress: () =>
              navigation.navigate(
                'ProfileTab'
              ),
          },
        ]
      );

      return;
    }

    Alert.alert(
      t('claim_btn'),
      `${t(
        'confirm_claim'
      )} "${offerTitle}"?`,
      [
        {
          text: t('cancel'),
          style: 'cancel',
        },
        {
          text: t('confirm'),
          style: 'default',

          onPress: async () => {
            try {
              const response =
                await offersApi.claim({
                  user_id:
                    user?.id || 0,
                  offer_id: offerId,
                });

              const claimed = offersSnapshotRef.current.find(o => o.id === offerId);
              setClaimedPickup(
                claimed ? groupOffersByRestaurant([claimed])[0] || null : null
              );

              setClaimedQr(
                response.data.qr_code
              );

              fetchLeaderboard();

              fetchData(userLocation);
            } catch (error: any) {
              Alert.alert(
                t('error'),
                t(apiErrorKey(error, 'generic_error', { 'Not Found': 'err_offer_not_found' }))
              );
            }
          },
        },
      ]
    );
  }, [
    user,
    t,
    navigation,
    userLocation,
    fetchData,
    fetchLeaderboard,
    refreshUser,
  ]);

  const handleSelectRestaurant = useCallback((restaurant: RestaurantGroup) => {
    setSelectedRestaurantKey(restaurant.key);
    animateToLocation(restaurant.lat, restaurant.lng);
  }, [animateToLocation]);

  // Close the card first so the claim alerts / QR modal are not stacked on top of it
  const handleCardClaim = useCallback((offerId: number, offerTitle: string) => {
    setSelectedRestaurantKey(null);
    handleClaim(offerId, offerTitle);
  }, [handleClaim]);

  /*
   * ---------------------------------------------------------
   * HEADER
   * ---------------------------------------------------------
   */

  const userFirstName =
    user?.name?.split(' ')[0] || '';

  const headerGreeting =
    `${t('hello')}, ${userFirstName}`;

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      {/* MAP */}
      <View style={styles.mapSection}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={region}
          region={region}
          showsUserLocation={false}
          showsMyLocationButton={false}
          customMapStyle={mapStyle}
          // Hide Google's marker toolbar (directions shortcut): routing is out of scope and the
          // restaurant card already offers "Open in Google Maps"
          toolbarEnabled={false}
          // Keep the camera centre, animateToRegion targets and the Google logo inside the visible part
          // of the map (below the header, above the list sheet) instead of under the overlays
          onMapReady={() =>
            setMapReady(true)
          }
          mapPadding={
            mapReady
              ? {
                  top: headerHeight,
                  right: 0,
                  bottom: SHEET_OVERLAP,
                  left: 0,
                }
              : undefined
          }
        >
          {restaurantGroups.map(
            restaurant => (
              <MapMarkerItem
                key={`marker-${restaurant.key}`}
                restaurant={restaurant}
                onSelect={
                  handleSelectRestaurant
                }
              />
            )
          )}
        </MapView>

        {/* CURRENT LOCATION */}
        <TouchableOpacity
          style={
            styles.myLocationBtn
          }
          onPress={centerMap}
          activeOpacity={0.8}
          hitSlop={{
            top: 10,
            bottom: 10,
            left: 10,
            right: 10,
          }}
        >
          <Ionicons
            name="locate-outline"
            size={24}
            color={COLORS.secondary}
          />
        </TouchableOpacity>

        {/* HOME HEADER */}
        <View
          style={[
            styles.homeHeader,
            {
              paddingTop:
                insets.top + 8,
            },
          ]}
          onLayout={e =>
            setHeaderHeight(
              Math.round(e.nativeEvent.layout.height)
            )
          }
        >
          <View
            style={
              styles.greetingContainer
            }
          >
            <Text
              style={
                styles.greetingText
              }
            >
              {headerGreeting}
            </Text>

            <Text
              style={
                styles.greetingSubtext
              }
            >
              {t('recommended')}
            </Text>
          </View>
        </View>
      </View>

      {/* BOTTOM SHEET */}
      <View
        style={[
          styles.listContainer,
          {
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          },
        ]}
      >
        <View
          style={styles.handleBar}
        />

        {/* Full-screen loader only until the first data arrives; afterwards refreshes keep
            the list mounted (pull-to-refresh shows its own spinner) */}
        {loading && !hasLoadedOffers && leaderboard.length === 0 ? (
          <View
            style={
              styles.centerContent
            }
          >
            <ActivityIndicator
              size="large"
              color={COLORS.primary}
            />

            <Text
              style={
                styles.loadingText
              }
            >
              {t('loading')}
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{
              paddingBottom: 60,
            }}
            showsVerticalScrollIndicator={
              false
            }
            refreshControl={
              <RefreshControl
                refreshing={
                  refreshing
                }
                onRefresh={
                  onRefresh
                }
                tintColor={
                  COLORS.primary
                }
              />
            }
          >
            {/* LEADERBOARD */}
            {leaderboard.length >
              0 && (
              <View
                style={
                  styles.sectionContainer
                }
              >
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  {t(
                    'top_restaurants'
                  )}
                </Text>

                <FlatList
                  data={
                    leaderboard
                  }
                  horizontal
                  showsHorizontalScrollIndicator={
                    false
                  }
                  renderItem={({
                    item,
                    index,
                  }) => (
                    <LeaderboardCard
                      item={item}
                      index={
                        index
                      }
                      t={t}
                    />
                  )}
                  keyExtractor={(
                    item,
                    index
                  ) =>
                    `leaderboard-${index}`
                  }
                  contentContainerStyle={{
                    paddingHorizontal: 20,
                  }}
                />
              </View>
            )}

            {/* RECOMMENDED */}
            {recommendedOffers.length >
              0 && (
              <View
                style={
                  styles.sectionContainer
                }
              >
                <View
                  style={{
                    flexDirection:
                      'row',
                    alignItems:
                      'center',
                    marginBottom: 12,
                    paddingLeft: 4,
                  }}
                >
                  <Ionicons
                    name="sparkles"
                    size={20}
                    color={
                      COLORS.gold
                    }
                    style={{
                      marginRight: 6,
                    }}
                  />

                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight:
                        '800',
                      color:
                        COLORS.primary,
                      letterSpacing:
                        -0.5,
                    }}
                  >
                    {t(
                      'recommended'
                    )}
                  </Text>
                </View>

                <FlatList
                  data={
                    recommendedOffers
                  }
                  horizontal
                  showsHorizontalScrollIndicator={
                    false
                  }
                  renderItem={({
                    item,
                  }) => (
                    <RecommendedCard
                      item={item}
                      onPressMap={
                        animateToLocation
                      }
                      onClaim={
                        handleClaim
                      }
                      t={t}
                    />
                  )}
                  keyExtractor={item =>
                    `recommended-${item.id}`
                  }
                  contentContainerStyle={{
                    paddingHorizontal: 20,
                  }}
                />
              </View>
            )}

            {/* FILTERS */}
            <View
              style={
                styles.filterContainer
              }
            >
              {(
                [
                  'all',
                  'free',
                  'discount',
                ] as FilterType[]
              ).map(tab => (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.filterBtn,
                    activeFilter ===
                      tab &&
                      styles.filterBtnActive,
                  ]}
                  onPress={() =>
                    setActiveFilter(
                      tab
                    )
                  }
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterText,
                      activeFilter ===
                        tab &&
                        styles.filterTextActive,
                    ]}
                  >
                    {toLangUpper(t(tab), lang)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ACTIVE OFFERS */}
            <View
              style={
                styles.offersSection
              }
            >
              {/* A failed refresh keeps the previous offers visible and only adds this note */}
              {offersError && allOffers.length > 0 ? (
                <Text style={styles.offersErrorNotice}>
                  {t('offers_load_failed')}
                </Text>
              ) : null}

              {/* The leaderboard can arrive before the location-dependent offers; until the
                  first offers response, show a small loader instead of the empty state */}
              {!hasLoadedOffers ? (
                <View style={styles.offersLoading}>
                  <ActivityIndicator color={COLORS.primary} />
                  <Text style={styles.loadingText}>{t('loading')}</Text>
                </View>
              ) : offersError && allOffers.length === 0 ? (
                // Failed load with nothing to show: say so instead of "no offers".
                // Retry goes through the normal refresh flow.
                <EmptyState
                  icon="cloud-offline-outline"
                  title={t('offers_load_failed')}
                  action={{
                    label: t('retry'),
                    onPress: onRefresh,
                  }}
                />
              ) : filteredOffers.length ===
              0 ? (
                <EmptyState
                  icon="fast-food-outline"
                  title={t('empty_list')}
                  action={{
                    label: t('refresh'),
                    onPress: onRefresh,
                  }}
                />
              ) : (
                filteredOffers.map(
                  offer => (
                    <OfferCard
                      key={`offer-${offer.id}`}
                      item={offer}
                      onPressMap={
                        animateToLocation
                      }
                      onClaim={
                        handleClaim
                      }
                      t={t}
                    />
                  )
                )
              )}
            </View>
          </ScrollView>
        )}
      </View>

      {/* QR SUCCESS MODAL */}
      <RestaurantInfoCard
        restaurant={selectedRestaurant}
        onClose={() =>
          setSelectedRestaurantKey(null)
        }
        onClaim={handleCardClaim}
        t={t}
      />

      <SuccessQrModal
        visible={!!claimedQr}
        onClose={() => {
          setClaimedQr(null);
          setClaimedPickup(null);
        }}
        qrCode={claimedQr}
        pickup={claimedPickup}
        t={t}
      />
    </View>
  );
};

export default HomeScreen;