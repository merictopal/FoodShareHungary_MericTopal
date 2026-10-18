import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

import { BottomSheet } from '../../../../components/BottomSheet';
import { Button } from '../../../../components/Button';
import { OfferTypeBadge } from '../../../../components/OfferTypeBadge';
import { PickupLocation } from '../../../../components/PickupLocation';
import { COLORS, SPACING, TYPOGRAPHY } from '../../../../constants/theme';

import type { RestaurantGroup } from '../utils';

interface Props {
  restaurant: RestaurantGroup | null;
  onClose: () => void;
  // The existing Home claim flow (verification check, confirm alert, QR modal)
  onClaim: (id: number, desc: string) => void;
  t: (key: string) => string;
}

export const RestaurantInfoCard: React.FC<Props> = ({ restaurant, onClose, onClaim, t }) => {
  return (
    <BottomSheet visible={!!restaurant} onClose={onClose} title={restaurant?.name}>
      {restaurant && (
        <View style={styles.content}>
          <Text style={styles.summary}>
            {t('offers_available')}: {restaurant.offers.length}
            {restaurant.distance !== undefined ? ` · ${restaurant.distance} ${t('dist_km')}` : ''}
          </Text>

          <ScrollView style={styles.list}>
            {restaurant.offers.map(offer => (
              <View key={offer.id} style={styles.offerRow}>
                <View style={styles.offerTexts}>
                  <OfferTypeBadge type={offer.type} discountRate={offer.discount_rate} />
                  <Text style={styles.offerDesc} numberOfLines={2}>{offer.description}</Text>
                  <Text style={styles.offerQty}>{offer.quantity} {t('left')}</Text>
                </View>
                <Button
                  title={t('claim_btn')}
                  size="sm"
                  onPress={() => onClaim(offer.id, offer.description)}
                />
              </View>
            ))}
          </ScrollView>

          <PickupLocation
            name={restaurant.name}
            address={restaurant.address}
            lat={restaurant.lat}
            lng={restaurant.lng}
            t={t}
            style={styles.pickup}
          />
        </View>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  // BottomSheet centres its children; the card needs the full sheet width
  content: {
    width: '100%',
  },
  summary: {
    color: COLORS.textSub,
    marginBottom: SPACING.md,
    ...TYPOGRAPHY.body,
  },
  list: {
    // Without flexGrow 0 the ScrollView always takes its full maxHeight, even for one offer
    flexGrow: 0,
    maxHeight: 260,
  },
  offerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.divider,
  },
  offerTexts: {
    flex: 1,
    marginRight: SPACING.md,
    alignItems: 'flex-start',
  },
  offerDesc: {
    color: COLORS.textMain,
    marginTop: SPACING.xs,
    ...TYPOGRAPHY.bodyMedium,
  },
  offerQty: {
    color: COLORS.textMuted,
    ...TYPOGRAPHY.caption,
  },
  pickup: {
    marginTop: SPACING.lg,
  },
});
