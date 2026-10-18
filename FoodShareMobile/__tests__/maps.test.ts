/**
 * Pure logic behind the Home map: restaurant grouping and "Open in Google Maps".
 */
import { Alert, Linking } from 'react-native';
import { buildGoogleMapsUrl, isValidCoordinate, openInGoogleMaps } from '../src/utils/maps';
import { groupOffersByRestaurant } from '../src/screens/student/home/utils';
import type { Offer } from '../src/screens/student/home/HomeScreen';

const offer = (over: Partial<Offer>): Offer => ({
  id: 1,
  restaurant: 'Bistro',
  restaurant_id: 7,
  address: 'Fő utca 1, Budapest',
  type: 'free',
  description: 'Soup',
  quantity: 2,
  discount_rate: 0,
  lat: 47.5,
  lng: 19.05,
  distance: 1.2,
  ...over,
});

describe('buildGoogleMapsUrl', () => {
  it('uses coordinates when present', () => {
    expect(buildGoogleMapsUrl(47.5, 19.05, 'ignored')).toBe(
      'https://www.google.com/maps/search/?api=1&query=47.5,19.05',
    );
    expect(buildGoogleMapsUrl('47.5', '19.05')).toContain('query=47.5,19.05');
  });

  it('falls back to the encoded address when coordinates are missing or invalid', () => {
    expect(buildGoogleMapsUrl(null, null, 'Fő utca 1, Budapest')).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Fő utca 1, Budapest')}`,
    );
    expect(buildGoogleMapsUrl('abc', 19, 'X')).toContain('query=X');
    expect(buildGoogleMapsUrl(95, 19, 'X')).toContain('query=X');
  });

  it('returns null when neither coordinates nor address exist (NULL address, null coords)', () => {
    expect(buildGoogleMapsUrl(null, undefined, null)).toBeNull();
    expect(buildGoogleMapsUrl('', '', '   ')).toBeNull();
  });

  it('never embeds an API key', () => {
    expect(buildGoogleMapsUrl(1, 2)).not.toMatch(/key=/i);
  });

  it('treats null/empty as missing, not as 0', () => {
    expect(isValidCoordinate(null, 0)).toBe(false);
    expect(isValidCoordinate(0, 0)).toBe(true);
  });
});

describe('openInGoogleMaps', () => {
  const t = (k: string) => k;
  afterEach(() => jest.restoreAllMocks());

  it('opens the external URL', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await expect(openInGoogleMaps(47.5, 19.05, null, t)).resolves.toBe(true);
    expect(open).toHaveBeenCalledWith('https://www.google.com/maps/search/?api=1&query=47.5,19.05');
  });

  it('alerts instead of throwing when Linking fails or there is no location', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await expect(openInGoogleMaps(47.5, 19.05, null, t)).resolves.toBe(false);
    await expect(openInGoogleMaps(null, null, null, t)).resolves.toBe(false);
    expect(alert).toHaveBeenCalledWith('error', 'maps_open_failed');
  });
});

describe('groupOffersByRestaurant', () => {
  it('makes one group per restaurant, keeping distance order and counting offers', () => {
    const groups = groupOffersByRestaurant([
      offer({ id: 1, restaurant_id: 7, type: 'discount' }),
      offer({ id: 2, restaurant_id: 9, restaurant: 'Pizza', lat: 47.6, distance: 2 }),
      offer({ id: 3, restaurant_id: 7, type: 'free' }),
    ]);
    expect(groups.map(g => g.key)).toEqual(['r-7', 'r-9']);
    expect(groups[0].offers.map(o => o.id)).toEqual([1, 3]);
    expect(groups[0].hasFree).toBe(true);
    expect(groups[1].hasFree).toBe(true);
  });

  it('marks discount-only restaurants and normalises a blank address to null', () => {
    const [g] = groupOffersByRestaurant([offer({ type: 'discount', address: '  ' })]);
    expect(g.hasFree).toBe(false);
    expect(g.address).toBeNull();
  });

  it('falls back to name + position when restaurant_id is missing', () => {
    const groups = groupOffersByRestaurant([
      offer({ id: 1, restaurant_id: undefined }),
      offer({ id: 2, restaurant_id: undefined }),
      offer({ id: 3, restaurant_id: undefined, restaurant: 'Other' }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].offers).toHaveLength(2);
  });

  it('skips offers without valid coordinates and handles an empty list', () => {
    expect(groupOffersByRestaurant([offer({ lat: 'x' }), offer({ lng: 200 })])).toEqual([]);
    expect(groupOffersByRestaurant([])).toEqual([]);
  });
});
