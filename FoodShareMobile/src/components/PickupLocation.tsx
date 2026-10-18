import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { Button } from './Button';
import { COLORS, SIZES, SPACING, TYPOGRAPHY } from '../constants/theme';
import { isValidCoordinate, openInGoogleMaps } from '../utils/maps';

interface PickupLocationProps {
  name: string;
  address?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  t: (key: string) => string;
  style?: ViewStyle;
}

// Pickup restaurant + "Open in Google Maps", shared by the Home restaurant card, the claim success
// modal and the Profile QR modal. A NULL address is shown as "not available"; the link then uses coordinates.
export const PickupLocation: React.FC<PickupLocationProps> = ({ name, address, lat, lng, t, style }) => {
  const canOpen = isValidCoordinate(lat, lng) || !!address?.trim();

  return (
    <View style={[styles.box, style]}>
      <View style={styles.row}>
        <Ionicons name="location-outline" size={18} color={COLORS.primary} />
        <View style={styles.texts}>
          <Text style={styles.label}>{t('pickup_location')}</Text>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.address} numberOfLines={2}>
            {address?.trim() || t('address_unavailable')}
          </Text>
        </View>
      </View>
      {canOpen && (
        <Button
          title={t('open_in_google_maps')}
          onPress={() => openInGoogleMaps(lat, lng, address, t)}
          variant="outline"
          size="sm"
          icon={<Ionicons name="navigate-outline" size={15} color={COLORS.primary} />}
          style={styles.button}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    width: '100%',
    padding: SPACING.md,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.surfaceSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  texts: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  label: {
    color: COLORS.textMuted,
    ...TYPOGRAPHY.caption,
  },
  name: {
    color: COLORS.textMain,
    ...TYPOGRAPHY.bodyBold,
  },
  address: {
    color: COLORS.textSub,
    ...TYPOGRAPHY.caption,
  },
  button: {
    marginTop: SPACING.md,
  },
});
