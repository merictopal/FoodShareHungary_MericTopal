import React from 'react';
import { View, Text } from 'react-native';
import { Marker } from 'react-native-maps';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { styles } from '../styles';
import { COLORS } from '../../../../constants/theme';

import type { RestaurantGroup } from '../utils';

interface Props {
  restaurant: RestaurantGroup;
  onSelect: (restaurant: RestaurantGroup) => void;
}

// One marker per restaurant; pressing it opens the RestaurantInfoCard (which replaced the per-offer Callout).
const MapMarkerItemComponent: React.FC<Props> = ({
  restaurant,
  onSelect,
}) => {
  const hasFree = restaurant.hasFree;
  const count = restaurant.offers.length;

  return (
    <Marker
      coordinate={{
        latitude: restaurant.lat,
        longitude: restaurant.lng,
      }}
      // Round icon: its centre is the restaurant's position (the default bottom-centre anchor drew it above).
      // No `title`: the native info bubble duplicated the RestaurantInfoCard and slid under the Home header.
      anchor={{ x: 0.5, y: 0.5 }}
      onPress={() => onSelect(restaurant)}
    >
      {/* Padded wrapper: the marker is snapshotted to a bitmap, so the badge must stay inside its bounds */}
      <View style={styles.markerWrap}>
        <View
          style={[
            styles.customMarker,
            hasFree
              ? styles.borderSuccess
              : styles.borderWarning,
          ]}
        >
          <Ionicons
            name={
              hasFree
                ? 'gift-outline'
                : 'pricetag-outline'
            }
            size={15}
            color={
              hasFree
                ? COLORS.success
                : COLORS.warning
            }
          />
        </View>

        {/* Active offer count of this restaurant */}
        {count > 1 && (
          <View style={styles.markerCountBadge}>
            <Text style={styles.markerCountText}>
              {count}
            </Text>
          </View>
        )}
      </View>
    </Marker>
  );
};

// Memoized: Home re-renders on unrelated state (filter chips, QR modal, refresh flags).
export const MapMarkerItem = React.memo(MapMarkerItemComponent);
