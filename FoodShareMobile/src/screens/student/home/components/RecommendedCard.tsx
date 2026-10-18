import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { Button } from '../../../../components/Button';
import { OfferTypeBadge } from '../../../../components/OfferTypeBadge';
import {
  COLORS,
  SIZES,
  SHADOWS,
  SPACING,
  TYPOGRAPHY,
} from '../../../../constants/theme';

import { Offer } from '../HomeScreen';

interface Props {
  item: Offer;
  onPressMap: (lat: number, lng: number) => void;
  onClaim: (id: number, desc: string) => void;
  t: any;
}

export const RecommendedCard: React.FC<Props> = ({
  item,
  onPressMap,
  onClaim,
  t,
}) => {
  const isFree = item.type === 'free';

  const typeColor = isFree
    ? COLORS.success
    : COLORS.warningText;

  const typeBackground = isFree
    ? COLORS.successLight
    : COLORS.warningLight;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() =>
        onPressMap(
          Number(item.lat),
          Number(item.lng),
        )
      }
    >
      {/* ------------------------------------------------ */}
      {/* IMAGE / ICON                                     */}
      {/* ------------------------------------------------ */}

      <View style={styles.topRow}>
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            style={styles.image}
          />
        ) : (
          <View
            style={[
              styles.imagePlaceholder,
              {
                backgroundColor: typeBackground,
              },
            ]}
          >
            <Ionicons
              name={
                isFree
                  ? 'gift-outline'
                  : 'restaurant-outline'
              }
              size={21}
              color={typeColor}
            />
          </View>
        )}

        <View style={styles.info}>
          <Text
            style={styles.restaurant}
            numberOfLines={1}
          >
            {item.restaurant}
          </Text>

          <Text
            style={styles.description}
            numberOfLines={1}
          >
            {item.description}
          </Text>
        </View>

        {/* AI indicator */}
        <View style={styles.aiBadge}>
          <Ionicons
            name="sparkles"
            size={12}
            color={COLORS.gold}
          />
        </View>
      </View>

      {/* ------------------------------------------------ */}
      {/* META                                             */}
      {/* ------------------------------------------------ */}

      <View style={styles.metaRow}>
        <OfferTypeBadge
          type={item.type}
          discountRate={item.discount_rate}
          showIcon
        />

        {item.distance !== undefined && (
          <View style={styles.distance}>
            <Ionicons
              name="location-outline"
              size={12}
              color={COLORS.textMuted}
            />

            <Text style={styles.distanceText}>
              {item.distance} {t('dist_km')}
            </Text>
          </View>
        )}
      </View>

      {/* ------------------------------------------------ */}
      {/* ACTION                                           */}
      {/* ------------------------------------------------ */}

      <View style={styles.footer}>
        <View style={styles.recommendationText}>
          <Ionicons
            name="sparkles-outline"
            size={14}
            color={COLORS.gold}
          />

          <Text style={styles.recommendationLabel}>
            {t('recommended')}
          </Text>
        </View>

        <Button
          title={t('claim_btn')}
          onPress={() =>
            onClaim(
              item.id,
              item.description,
            )
          }
          size="sm"
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // ------------------------------------------------------
  // CARD
  // ------------------------------------------------------

  card: {
    width: 270,

    padding: SPACING.lg,

    marginRight: SPACING.md,

    backgroundColor: COLORS.surface,

    borderRadius: SIZES.radiusMd,

    borderWidth: 1,
    borderColor: COLORS.border,

    ...SHADOWS.light,
  },

  // ------------------------------------------------------
  // TOP
  // ------------------------------------------------------

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  image: {
    width: 48,
    height: 48,

    borderRadius: SIZES.radius,

    marginRight: SPACING.md,

    backgroundColor: COLORS.surfaceMuted,
  },

  imagePlaceholder: {
    width: 48,
    height: 48,

    borderRadius: SIZES.radius,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: SPACING.md,
  },

  info: {
    flex: 1,
    minWidth: 0,
  },

  restaurant: {
    color: COLORS.textMain,
    ...TYPOGRAPHY.bodyBold,
    fontSize: 15,
  },

  description: {
    marginTop: 3,

    color: COLORS.textMuted,

    ...TYPOGRAPHY.caption,
  },

  aiBadge: {
    width: 28,
    height: 28,

    marginLeft: SPACING.sm,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.warningLight,

    borderRadius: SIZES.radiusFull,
  },

  // ------------------------------------------------------
  // META
  // ------------------------------------------------------

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    marginTop: SPACING.lg,
  },


  distance: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  distanceText: {
    marginLeft: 3,

    color: COLORS.textMuted,

    ...TYPOGRAPHY.caption,
  },

  // ------------------------------------------------------
  // FOOTER
  // ------------------------------------------------------

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    marginTop: SPACING.lg,
  },

  recommendationText: {
    flexDirection: 'row',
    alignItems: 'center',

    flex: 1,
  },

  recommendationLabel: {
    marginLeft: 5,

    color: COLORS.textMuted,

    fontSize: 11,
    fontWeight: '600',
  },
});