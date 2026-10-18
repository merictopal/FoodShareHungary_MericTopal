import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  COLORS,
  SIZES,
  SHADOWS,
  SPACING,
  TYPOGRAPHY,
} from '../constants/theme';

interface OfferCardProps {
  item: any;
  onClaim: () => void;
  t: (key: string) => string;
}

export const OfferCard = ({
  item,
  onClaim,
  t,
}: OfferCardProps) => {
  const isFree = item.type === 'free';
  const isRecommended = item.is_recommended;

  return (
    <View style={[styles.card, isRecommended && styles.recommendedCard]}>

      {/* Recommended indicator */}
      {isRecommended && (
        <View style={styles.recommendedBadge}>
          <Ionicons
            name="sparkles"
            size={12}
            color={COLORS.white}
          />
          <Text style={styles.recommendedText}>
            {t('recommended')}
          </Text>
        </View>
      )}

      {/* -------------------------------------------------- */}
      {/* HEADER                                             */}
      {/* -------------------------------------------------- */}

      <View style={styles.header}>

        <View
          style={[
            styles.iconBox,
            isFree ? styles.freeIconBox : styles.discountIconBox,
          ]}
        >
          <Ionicons
            name={isFree ? 'gift-outline' : 'restaurant-outline'}
            size={22}
            color={isFree ? COLORS.success : COLORS.primary}
          />
        </View>

        <View style={styles.mainInfo}>
          <Text
            style={styles.restName}
            numberOfLines={1}
          >
            {item.restaurant}
          </Text>

          <View style={styles.distanceRow}>
            <Ionicons
              name="location-outline"
              size={13}
              color={COLORS.textMuted}
            />

            <Text style={styles.dist}>
              {item.distance} km
            </Text>
          </View>
        </View>

        {/* Offer type badge */}
        <View
          style={[
            styles.tag,
            isFree
              ? styles.freeTag
              : styles.discountTag,
          ]}
        >
          <Text
            style={[
              styles.tagText,
              isFree
                ? styles.freeTagText
                : styles.discountTagText,
            ]}
          >
            {isFree
              ? t('free')
              : `-${item.discount_rate}%`}
          </Text>
        </View>
      </View>

      {/* -------------------------------------------------- */}
      {/* DESCRIPTION                                        */}
      {/* -------------------------------------------------- */}

      <Text
        style={styles.desc}
        numberOfLines={2}
      >
        {item.description}
      </Text>

      {/* -------------------------------------------------- */}
      {/* FOOTER                                             */}
      {/* -------------------------------------------------- */}

      <View style={styles.footer}>

        <View style={styles.stockContainer}>
          <Ionicons
            name="layers-outline"
            size={15}
            color={COLORS.textMuted}
          />

          <Text style={styles.stock}>
            {item.quantity} {t('left')}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.btn}
          onPress={onClaim}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel={t('claim_btn')}
        >
          <Text style={styles.btnText}>
            {t('claim_btn')}
          </Text>

          <Ionicons
            name="arrow-forward"
            size={15}
            color={COLORS.white}
          />
        </TouchableOpacity>

      </View>
    </View>
  );
};

const styles = StyleSheet.create({

  // -------------------------------------------------------
  // CARD
  // -------------------------------------------------------

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    marginHorizontal: SPACING.xxl,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.light,
  },

  recommendedCard: {
    borderColor: '#E7C87A',
    backgroundColor: '#FFFDF8',
  },

  // -------------------------------------------------------
  // RECOMMENDED BADGE
  // -------------------------------------------------------

  recommendedBadge: {
    position: 'absolute',
    top: 12,
    right: 14,

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 9,
    paddingVertical: 5,

    borderRadius: SIZES.radiusFull,
    backgroundColor: COLORS.gold,

    ...SHADOWS.light,

    zIndex: 10,
  },

  recommendedText: {
    marginLeft: 4,
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '700',
  },

  // -------------------------------------------------------
  // HEADER
  // -------------------------------------------------------

  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconBox: {
    width: 50,
    height: 50,
    borderRadius: SIZES.radius,
    justifyContent: 'center',
    alignItems: 'center',
  },

  freeIconBox: {
    backgroundColor: COLORS.successLight,
  },

  discountIconBox: {
    backgroundColor: COLORS.primaryLight,
  },

  mainInfo: {
    flex: 1,
    marginLeft: SPACING.md,
    marginRight: SPACING.sm,
  },

  restName: {
    color: COLORS.textMain,
    ...TYPOGRAPHY.bodyBold,
    fontSize: 16,
  },

  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },

  dist: {
    marginLeft: 3,
    color: COLORS.textMuted,
    ...TYPOGRAPHY.caption,
  },

  // -------------------------------------------------------
  // OFFER TYPE
  // -------------------------------------------------------

  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: SIZES.radiusSm,
  },

  freeTag: {
    backgroundColor: COLORS.successLight,
  },

  discountTag: {
    backgroundColor: COLORS.warningLight,
  },

  tagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  freeTagText: {
    color: COLORS.success,
  },

  discountTagText: {
    color: '#C77A20',
  },

  // -------------------------------------------------------
  // DESCRIPTION
  // -------------------------------------------------------

  desc: {
    color: COLORS.textSub,
    fontSize: 13,
    lineHeight: 19,
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
  },

  // -------------------------------------------------------
  // FOOTER
  // -------------------------------------------------------

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  stockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  stock: {
    marginLeft: 5,
    color: COLORS.textMuted,
    ...TYPOGRAPHY.caption,
  },

  btn: {
    minWidth: 92,
    height: 40,

    paddingHorizontal: 14,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: SIZES.radiusSm,
    backgroundColor: COLORS.primary,

    ...SHADOWS.light,
  },

  btnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
    marginRight: 6,
  },
});