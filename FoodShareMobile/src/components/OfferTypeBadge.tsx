import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { COLORS, SIZES } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { toLangUpper } from '../utils/text';

interface OfferTypeBadgeProps {
  type: 'free' | 'discount' | string;
  discountRate?: number;
  showIcon?: boolean;
  // 'pill' = fully rounded (map callout), 'tag' = small radius (cards, lists)
  shape?: 'tag' | 'pill';
  style?: ViewStyle;
}

// Single place for the free/discount badge look and label format ("FREE" / "20% DISCOUNT")
export const OfferTypeBadge = ({
  type,
  discountRate = 0,
  showIcon = false,
  shape = 'tag',
  style,
}: OfferTypeBadgeProps) => {
  const { t, lang } = useAuth();
  const isFree = type === 'free';

  const textColor = isFree ? COLORS.success : COLORS.warningText;
  const backgroundColor = isFree ? COLORS.successLight : COLORS.warningLight;

  const label = isFree
    ? toLangUpper(t('free'), lang)
    : `${discountRate}% ${toLangUpper(t('discount'), lang)}`;

  return (
    <View
      style={[
        styles.badge,
        shape === 'pill' && styles.pill,
        { backgroundColor },
        style,
      ]}
    >
      {showIcon && (
        <Ionicons
          name={isFree ? 'gift-outline' : 'pricetag-outline'}
          size={12}
          color={textColor}
          style={styles.icon}
        />
      )}
      <Text style={[styles.text, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: SIZES.radiusSm,
  },

  pill: {
    borderRadius: SIZES.radiusFull,
  },

  icon: {
    marginRight: 4,
  },

  text: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});

export default OfferTypeBadge;
