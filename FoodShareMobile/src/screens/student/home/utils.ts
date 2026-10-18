import type { Offer } from './HomeScreen';
import type {
  GeolocationError,
  GeolocationOptions,
  GeolocationResponse,
} from '@react-native-community/geolocation';
import { isValidCoordinate } from '../../../utils/maps';

// --- LOCATION ---

// A real device position. The app never invents one: until the device returns a fix the position is null.
export type LatLng = { lat: number; lng: number };

// Map viewport ONLY, used before the first device fix and when none can be obtained (permission denied,
// both attempts failed). It is never treated as the user's position: not sent to the backend, not used for
// distances or ranking. A Budapest view simply because the service targets Hungarian students.
export const FALLBACK_MAP_CENTER = { latitude: 47.4979, longitude: 19.0402 };

// Query string for /offers and /recommendations: coordinates only when the device really returned a fix.
// Without them the backend shows no distances and ranks recommendations without proximity.
export const locationQuery = (location: LatLng | null): string =>
  location ? `lat=${location.lat}&lng=${location.lng}` : '';

// Great-circle distance in km (same formula as the backend's haversine_km)
export const distanceKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) {
    return 0;
  }
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// A new fix only reloads the lists when the device really moved (GPS jitter stays below this)
export const RELOAD_DISTANCE_KM = 0.2;

export const movedSignificantly = (previous: LatLng | null, next: LatLng): boolean =>
  previous === null || distanceKm(previous.lat, previous.lng, next.lat, next.lng) >= RELOAD_DISTANCE_KM;


// First attempt: cached / network position, quick indoors. 6 s instead of the former 2.5 s, which
// gave up before a normal fix arrived and silently left the user in Budapest (audit M1).
export const LOCATION_OPTIONS: Required<
  Pick<GeolocationOptions, 'enableHighAccuracy' | 'timeout' | 'maximumAge'>
> = {
  enableHighAccuracy: false,
  timeout: 6000,
  maximumAge: 3600000,
};

// The one retry: GPS, for devices without a network/cached fix
export const LOCATION_RETRY_OPTIONS: typeof LOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 3600000,
};

// Pull-to-refresh / return to the foreground: the CURRENT position (cache at most 1 minute old), so a
// user who moved since the last fix (other district or city) is located again. Same two steps as the
// startup (network/cached, then GPS), because some devices only have a GPS position.
export const LOCATION_REFRESH_OPTIONS: typeof LOCATION_OPTIONS = { ...LOCATION_OPTIONS, maximumAge: 60000 };
export const LOCATION_REFRESH_RETRY_OPTIONS: typeof LOCATION_OPTIONS = { ...LOCATION_RETRY_OPTIONS, maximumAge: 60000 };

// Some providers never call back: each attempt also ends this long after its own timeout
export const LOCATION_FAILSAFE_GRACE_MS = 1000;

// Matches GeolocationError.PERMISSION_DENIED (W3C code 1); a denial is not worth a retry
const PERMISSION_DENIED = 1;

type GetPosition = (
  success: (position: GeolocationResponse) => void,
  error: (error: GeolocationError) => void,
  options: GeolocationOptions,
) => void;

/*
 * Asks for the position once with `firstOptions` (default LOCATION_OPTIONS) and, if that fails or times out,
 * ONE more time with `retryOptions` (default LOCATION_RETRY_OPTIONS). Only one failsafe timer is live at a time.
 * - onFix is called for every position that arrives, also a late one after onGiveUp.
 * - onGiveUp is called at most once, and only after both attempts failed (or on a permission denial).
 */
export const requestPositionWithRetry = (
  getPosition: GetPosition,
  onFix: (latitude: number, longitude: number) => void,
  onGiveUp: () => void,
  firstOptions: typeof LOCATION_OPTIONS = LOCATION_OPTIONS,
  retryOptions: typeof LOCATION_OPTIONS = LOCATION_RETRY_OPTIONS,
): void => {
  let settled = false;
  let retried = false;
  let failsafe: ReturnType<typeof setTimeout> | null = null;

  const clearFailsafe = () => {
    if (failsafe) {
      clearTimeout(failsafe);
      failsafe = null;
    }
  };

  const giveUp = () => {
    if (!settled) {
      settled = true;
      clearFailsafe();
      onGiveUp();
    }
  };

  const attempt = (options: typeof LOCATION_OPTIONS, onFail: (error?: GeolocationError) => void) => {
    clearFailsafe();
    failsafe = setTimeout(() => onFail(), options.timeout + LOCATION_FAILSAFE_GRACE_MS);
    getPosition(
      position => {
        if (!settled) {
          settled = true;
          clearFailsafe();
        }
        onFix(position.coords.latitude, position.coords.longitude);
      },
      error => onFail(error),
      options,
    );
  };

  const retryOnce = (error?: GeolocationError) => {
    if (settled || retried) {
      return;
    }
    if (error?.code === PERMISSION_DENIED) {
      giveUp();
      return;
    }
    retried = true;
    attempt(retryOptions, giveUp);
  };

  attempt(firstOptions, retryOnce);
};

// One map marker / info card per restaurant (the backend returns one row per offer).
export interface RestaurantGroup {
  key: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  distance?: number;
  hasFree: boolean;
  offers: Offer[];
}

export const groupOffersByRestaurant = (offers: Offer[]): RestaurantGroup[] => {
  const groups = new Map<string, RestaurantGroup>();

  for (const offer of offers) {
    if (!isValidCoordinate(offer.lat, offer.lng)) {
      continue;
    }
    const lat = Number(offer.lat);
    const lng = Number(offer.lng);
    // Older payloads have no restaurant_id: name + position still identifies the restaurant
    const key =
      offer.restaurant_id !== undefined && offer.restaurant_id !== null
        ? `r-${offer.restaurant_id}`
        : `n-${offer.restaurant}|${lat}|${lng}`;

    const group = groups.get(key);
    if (group) {
      group.offers.push(offer);
      group.hasFree = group.hasFree || offer.type === 'free';
    } else {
      // Insertion order keeps the distance order of the (already sorted) offer list
      groups.set(key, {
        key,
        name: offer.restaurant,
        address: offer.address?.trim() || null,
        lat,
        lng,
        distance: offer.distance,
        hasFree: offer.type === 'free',
        offers: [offer],
      });
    }
  }

  return Array.from(groups.values());
};
