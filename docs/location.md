# Location and PostGIS

## Purpose
Store restaurant coordinates, keep a PostGIS point in sync with them, and sort offers by distance from the user.

## Files
- `backend/app/models/user.py`: `RestaurantProfile.lat/lng/geom`, event `_sync_restaurant_geom` (before_insert/before_update)
- `backend/app/services/auth_service.py`: `AuthService.parse_coordinates` (WGS84 range check), used at registration and by the location route
- `backend/app/routes/restaurant_routes.py`: `GET/PUT /api/restaurant/location`
- `backend/app/routes/student_routes.py`: `GET /api/offers?lat&lng` (`ST_DistanceSphere`, km, ascending)
- `backend/migrations/2026-09-29_restaurant_geom_backfill_index.sql` (backfill plus GiST index `idx_restaurant_profiles_geom`)
- Mobile: `FoodShareMobile/src/screens/restaurant/DashboardScreen.tsx` ("Use my current location" card)
- Mobile Home map: `screens/student/home/HomeScreen.tsx` (MapView, `PROVIDER_GOOGLE`), `home/utils.ts`
  (`groupOffersByRestaurant`), `home/components/MapMarkerItem.tsx`, `home/components/RestaurantInfoCard.tsx`
- Mobile shared: `src/utils/maps.ts` (`buildGoogleMapsUrl`, `openInGoogleMaps`), `src/components/PickupLocation.tsx`

## Workflow
- Write `lat`/`lng` only. The model event sets `geom = POINT(lng lat)`, SRID 4326 (x = longitude).
- Registration: optional `lat`/`lng`/`address`. Invalid or missing coordinates fall back to the placeholder (41.0, 28.9).
- `/api/offers`: active offers (`claimable_offer_conditions()`), ordered by spherical distance when the request carries `lat`+`lng`; without them (position unknown) `distance` is `null` and the order is newest first. There is no server-side default position (the former Istanbul default was removed 2026-10-08, audit F10).

## Rules
- Never write `geom` directly; it is derived from `lat`/`lng` by a model event. A PUT with invalid coordinates → 400.

## Google Maps key (mobile map tiles, Fix 6 – 2026-10-07)
- The Home map needs a Maps SDK for Android key. It is never committed: put `MAPS_API_KEY=<key>` in the git-ignored
  `FoodShareMobile/.env` (or the `MAPS_API_KEY` environment variable); `android/app/build.gradle` injects it into
  `AndroidManifest.xml` via the `${MAPS_API_KEY}` manifest placeholder. Rebuild the app after changing it.
- Without a key the build still works (marker value `MAPS_API_KEY_NOT_SET`); the map stays grey and logcat shows
  `Google Android Maps SDK: Authorization failure`.
- Google Cloud setup (outside the repo): enable "Maps SDK for Android" and billing on the project; restrict the key to
  Android apps with package `com.foodsharemobile` and the signing SHA-1 (debug keystore:
  `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`; add the release SHA-1 for release builds).

## Home map, restaurant card, pickup location (2026-10-08)
- Flow: Home map → one marker per restaurant (green = has a free offer, orange = discount only, red badge = active
  offer count) → `RestaurantInfoCard` (BottomSheet: name, active offers, distance, each offer with CLAIM) → the
  existing Home `handleClaim` (verification check, confirm alert, QR modal) → `SuccessQrModal` shows the pickup location.
  Profile history → `QrModal` also shows the pickup location. All three use `PickupLocation`.
- Data: `/api/offers` items now also carry `restaurant_id` and `address`; `/api/student/history/<id>` items carry
  `restaurant_address`, `lat`, `lng` (additive keys). Markers group by `restaurant_id` (fallback: name + position)
  and follow the free/discount filter chips.
- "Open in Google Maps": `https://www.google.com/maps/search/?api=1&query=<lat>,<lng>` via `Linking.openURL`
  (Maps app if installed, otherwise the browser). Coordinates win; the address is the fallback; with neither, the
  button is hidden. A NULL address shows "Address not available". No API key in the URL.
- Viewport: the translucent Home header and the list sheet overlap the map, so `mapPadding` (measured header height
  top, `SHEET_OVERLAP` bottom) keeps the camera centre, marker focus and Google logo in the visible area. It is applied
  only after `onMapReady`: react-native-maps 1.27.2 on Android throws an NPE in `GoogleMap.setPadding` otherwise.
- Markers are anchored at their centre (`anchor={{ x: 0.5, y: 0.5 }}`), so the round icon sits on the restaurant's
  coordinate. They have no native `title`: a tap opens only the `RestaurantInfoCard`.
- Offers of suspended restaurants are not returned by `/api/offers`, so they get no marker (see `claims.md`).
- The per-offer marker Callout was replaced by the restaurant card. Google's marker toolbar is disabled
  (`toolbarEnabled={false}`). Routes, directions, in-app navigation and Places are out of scope.
- The Maps key is injected at **build** time: an APK built before `MAPS_API_KEY` was set keeps
  `MAPS_API_KEY_NOT_SET` (grey map) until it is rebuilt (`gradlew installDebug` / `npm run android`).

## Student location bootstrap (2026-10-08)
- `requestPositionWithRetry` (`screens/student/home/utils.ts`): a first low-accuracy attempt (`LOCATION_OPTIONS`:
  network or cached position, 6 s, formerly 2.5 s), then **one** high-accuracy GPS retry (`LOCATION_RETRY_OPTIONS`,
  10 s). Each attempt has a failsafe of its timeout plus 1 s, for providers that never call back; only one timer is live.
- Without a device fix (both attempts failed, or permission denied → no retry) the lists load **without a position**
  (`fetchData(null)`: no `lat`/`lng` sent, no distances shown, recommendations without proximity). `FALLBACK_MAP_CENTER`
  (Budapest 47.4979/19.0402, `home/utils.ts`) is only the map's starting viewport and is never sent or used for distances.
  A fix arriving after that load is applied and the lists reload with it (audit F10).
- Worst case before the first offers load: about 18 s (6 + 1 + 10 + 1) when location is on but no fix arrives. With
  location services off, both attempts fail at once and the fallback loads immediately.
- Pull-to-refresh and return to the foreground (`tryLocationInBackground`): reload at once with the last real fix (or none),
  then ask for the CURRENT position in the same two steps with a 60 s cache (`LOCATION_REFRESH_OPTIONS` /
  `LOCATION_REFRESH_RETRY_OPTIONS`); if the device moved ≥ 0.2 km (`movedSignificantly`) the lists reload with the new position.
  The startup bootstrap still accepts a cached fix up to 1 h old (fast start); the next refresh/foreground corrects it.

## Known limitations
- `GET /api/offers?lat=abc` → 500 leaking `str(e)` (pinned `xfail`, `tests/edge/test_edge_inputs.py`).
- `/api/recommendations` computes Haversine in Python rather than PostGIS (identical results; see `recommendations.md`).
- Existing restaurants (e.g. 11 "Burger") keep placeholder coordinates until the owner sets a location. Mobile registration sends no coordinates.
- Restaurants at identical coordinates (e.g. several on the 41.0/28.9 placeholder) give overlapping markers; there is no clustering.
- The model's column defaults (Budapest 47.4979/19.0402) differ from the registration placeholder (41.0/28.9).

## Evidence
Fix 17: nearest offer first (1.89 km); PostGIS distance equals the app formula (0.00 km difference). Smoke test `test_public_offers_sorted_by_distance`.

Home map (2026-10-08):
- Automated:
  - Jest `FoodShareMobile/__tests__/maps.test.ts` (11 tests: URL builder, NULL address/coordinates, Linking failure, grouping)
  - smoke `test_public_offers_carry_pickup_location` and `test_student_history_carries_pickup_location`
  - edge `tests/edge/test_edge_map_pickup.py`
  - opt-in writes `tests/writes/test_map_pickup_flow.py`: NULL address, 2 offers at one restaurant, claim → history (2 passed)
  - gate green, mobile TS 14 = baseline
- The dev DB had 0 live offers, so the gate's offer-level checks ran on an empty list. The writes test covers that path.
- Emulator (Android, debug build rebuilt with the key, [TEST] data, removed afterwards with `cleanup_test_data.py --apply`):
  - map tiles loaded with no `Authorization failure`
  - 2 restaurant markers (count badge "2")
  - marker → card; NULL-address card shows "Address not available"
  - card CLAIM → existing confirm → QR modal with pickup location
  - Profile history QR shows pickup location
  - "Open in Google Maps" launched `com.google.android.apps.maps` at the exact coordinates
- NOT TESTED: physical Android device, iOS.
- Maps app disabled (`pm disable-user`): the same VIEW intent went to Chrome. The page itself was not checked: Chrome's
  first-run consent screen was left for the user.

Location bootstrap (2026-10-08):
- Jest `__tests__/location.test.ts` (8 tests: first fix, timeout → retry, silent provider → failsafe retry, both fail →
  one fallback, permission denied → no retry, late fix, no leftover timers).
- Emulator; real location from the Windows Location service (±94 m). Each case made exactly one `/api/offers` request:
  - A, cached network fix: real coordinates, no GPS retry
  - B, no network fix: 6 s network attempt, then GPS retry; the injected fix was used and Budapest never sent
  - C, location services off: one fallback request
  - D, permission denied: one fallback request, no location request
- `__tests__/App.test.tsx` fails to parse `@react-native-firebase/messaging` (ESM). This is a pre-existing Jest config issue, unrelated to the map.

## Thesis
Spatial design / PostGIS section. Don't reuse the archived statement "geom never written" (PROJECT_STATE §9).

## Emulator evidence (2026-10-08, audit F10)
Permission granted, `adb emu geo fix` to Debrecen 47.5316/21.6273 → app requests `lat=47.5316…&lng=21.6273…`, 193.58 km to the
[TEST] restaurant; geo fix moved to Szeged 46.2530/20.1414 → pull-to-refresh reloaded with `lat=46.253&lng=20.1414` (161.48 km), map
centred on Szeged. Permission revoked → `/api/offers?user_id=…` and `/api/recommendations/…` without coordinates, no distances shown.
Emulator note: a `geo fix` is only stored while an app is actively requesting GPS (the network provider has no position on this AVD).
Jest: `__tests__/locationRequests.test.ts`. Backend: `tests/edge/test_edge_audit_fixes.py` (F10 tests).
