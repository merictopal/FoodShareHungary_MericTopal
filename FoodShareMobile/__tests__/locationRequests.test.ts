/**
 * Audit F10 (2026-10-08): the app sends a position only when the DEVICE returned one; the map fallback is
 * never sent as the user's location. Covers the pieces HomeScreen combines (bootstrap -> fetch -> request URL).
 */
jest.mock('../src/api/client', () => ({ client: { get: jest.fn(() => Promise.resolve({ data: [] })) } }));
jest.mock('react-native-image-picker', () => ({}));

import { client } from '../src/api/client';
import { offersApi } from '../src/api/offers';
import {
  FALLBACK_MAP_CENTER,
  LOCATION_REFRESH_OPTIONS,
  LOCATION_REFRESH_RETRY_OPTIONS,
  LatLng,
  distanceKm,
  locationQuery,
  movedSignificantly,
  requestPositionWithRetry,
} from '../src/screens/student/home/utils';

const fix = (latitude: number, longitude: number) => ({ coords: { latitude, longitude } });
const DENIED = { code: 1 };
const TIMEOUT = { code: 3 };

// Mirrors HomeScreen's bootstrap: a fix -> fetch(fix); both attempts failed / denied -> fetch(null)
const bootstrap = (answers: Array<(s: any, e: any) => void>) => {
  const fetches: Array<LatLng | null> = [];
  let call = 0;
  requestPositionWithRetry(
    (success, error) => answers[call++](success, error),
    (lat, lng) => fetches.push({ lat, lng }),
    () => fetches.push(null),
  );
  return fetches;
};

describe('location sent to the backend', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('real device coordinates are used as they are (any city)', () => {
    expect(bootstrap([s => s(fix(46.0727, 18.2323))])).toEqual([{ lat: 46.0727, lng: 18.2323 }]);
    expect(bootstrap([s => s(fix(41.0082, 28.9784))])).toEqual([{ lat: 41.0082, lng: 28.9784 }]);
  });

  it('permission denied -> no position (not the fallback map centre)', () => {
    expect(bootstrap([(_s, e) => e(DENIED)])).toEqual([null]);
  });

  it('both attempts time out -> no position', () => {
    expect(bootstrap([(_s, e) => e(TIMEOUT), (_s, e) => e(TIMEOUT)])).toEqual([null]);
  });

  it('first attempt times out, retry returns the device position', () => {
    expect(bootstrap([(_s, e) => e(TIMEOUT), s => s(fix(47.5, 19.05))])).toEqual([{ lat: 47.5, lng: 19.05 }]);
  });

  it('a provider that never answers ends in "no position" after the failsafe timers', () => {
    const fetches: Array<LatLng | null> = [];
    requestPositionWithRetry(() => {}, (lat, lng) => fetches.push({ lat, lng }), () => fetches.push(null));
    jest.runAllTimers();
    expect(fetches).toEqual([null]);
  });
});

describe('request URLs', () => {
  beforeEach(() => (client.get as jest.Mock).mockClear());

  it('recommendation query has coordinates only for a real position', () => {
    expect(locationQuery({ lat: 46.0727, lng: 18.2323 })).toBe('lat=46.0727&lng=18.2323');
    expect(locationQuery(null)).toBe('');
  });

  it('offers request without a position carries no coordinates', () => {
    offersApi.getAll(5, null);
    const url = (client.get as jest.Mock).mock.calls[0][0] as string;
    expect(url).not.toMatch(/lat=|lng=/);
    expect(url).not.toContain(String(FALLBACK_MAP_CENTER.latitude));
  });

  it('offers request with a position carries exactly that position', () => {
    offersApi.getAll(5, { lat: 46.0727, lng: 18.2323 });
    const url = (client.get as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('lat=46.0727');
    expect(url).toContain('lng=18.2323');
  });
});

describe('following the device when it moves', () => {
  it('first fix always counts as a move', () => {
    expect(movedSignificantly(null, { lat: 47.5, lng: 19.05 })).toBe(true);
  });

  it('GPS jitter does not reload, another district or city does', () => {
    const budapest = { lat: 47.4979, lng: 19.0402 };
    expect(movedSignificantly(budapest, { lat: 47.4980, lng: 19.0403 })).toBe(false);
    expect(movedSignificantly(budapest, { lat: 47.5100, lng: 19.0402 })).toBe(true);
    expect(movedSignificantly(budapest, { lat: 46.0727, lng: 18.2323 })).toBe(true);
  });

  it('refresh asks for a CURRENT position in the same two steps (network/cache, then GPS)', () => {
    jest.useFakeTimers();
    const options: any[] = [];
    const fixes: LatLng[] = [];
    requestPositionWithRetry(
      (success: any, error: any, opts: any) => {
        options.push(opts);
        if (options.length === 1) error(TIMEOUT); else success(fix(46.253, 20.1414));
      },
      (lat, lng) => fixes.push({ lat, lng }),
      () => {},
      LOCATION_REFRESH_OPTIONS,
      LOCATION_REFRESH_RETRY_OPTIONS,
    );
    jest.useRealTimers();
    expect(options).toEqual([LOCATION_REFRESH_OPTIONS, LOCATION_REFRESH_RETRY_OPTIONS]);
    expect(options.every(o => o.maximumAge <= 60000)).toBe(true);
    expect(options[1].enableHighAccuracy).toBe(true);
    expect(fixes).toEqual([{ lat: 46.253, lng: 20.1414 }]);
  });

  it('distance matches the backend formula (Budapest -> Pécs about 170 km)', () => {
    expect(distanceKm(47.4979, 19.0402, 46.0727, 18.2323)).toBeCloseTo(170.1, 0);
    expect(distanceKm(NaN, 0, 1, 1)).toBe(0);
  });
});
