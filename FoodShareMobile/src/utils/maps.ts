import { Alert, Linking } from 'react-native';

// External "Open in Google Maps" links. Uses the public Maps URLs API, which opens the Google Maps
// app when installed and the browser otherwise. No API key is involved (the key in .env is only for
// the embedded Maps SDK) and no in-app routing/directions are done here on purpose.

type Coord = number | string | null | undefined;

const toCoord = (value: Coord): number | null => {
  // Number(null) / Number('') are 0: treat them as missing instead of a point in the Gulf of Guinea
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export const isValidCoordinate = (lat: Coord, lng: Coord): boolean => {
  const la = toCoord(lat);
  const ln = toCoord(lng);
  return la !== null && ln !== null && Math.abs(la) <= 90 && Math.abs(ln) <= 180;
};

// Coordinates win (they are what the map marker shows); the address is the fallback when they are missing.
export const buildGoogleMapsUrl = (
  lat: Coord,
  lng: Coord,
  address?: string | null,
): string | null => {
  if (isValidCoordinate(lat, lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${toCoord(lat)},${toCoord(lng)}`;
  }
  const query = address?.trim();
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : null;
};

export const openInGoogleMaps = async (
  lat: Coord,
  lng: Coord,
  address: string | null | undefined,
  t: (key: string) => string,
): Promise<boolean> => {
  const url = buildGoogleMapsUrl(lat, lng, address);
  try {
    if (!url) {
      throw new Error('no location');
    }
    await Linking.openURL(url);
    return true;
  } catch {
    Alert.alert(t('error'), t('maps_open_failed'));
    return false;
  }
};
