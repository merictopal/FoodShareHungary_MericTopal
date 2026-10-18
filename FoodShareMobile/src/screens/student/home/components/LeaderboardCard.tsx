import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { styles as homeStyles } from '../styles';
import { COLORS, SIZES, SPACING, SHADOWS } from '../../../../constants/theme';
import { LeaderboardEntry } from '../HomeScreen';

interface Props {
  item: LeaderboardEntry;
  index: number;
  t: any;
}

export const LeaderboardCard: React.FC<Props> = ({
  item,
  index,
  t,
}) => {
  const isTop3 = index < 3;

  const rankIcons = [
    'trophy',
    'medal-outline',
    'medal-outline',
  ];

  const rankColors = [
    '#F4A261',
    '#9CA3AF',
    '#D97706',
  ];

  const rankColor = isTop3
    ? rankColors[index]
    : COLORS.textMuted;

  return (
    <View
      style={[
        homeStyles.lbCard,
        styles.card,
        isTop3 && homeStyles.lbCardHighlight,
        isTop3 && styles.topCard,
      ]}
    >
      {/* RANK */}
      <View
        style={[
          styles.rankCircle,
          {
            backgroundColor: isTop3
              ? `${rankColor}18`
              : COLORS.surfaceMuted,
          },
        ]}
      >
        {isTop3 ? (
          <Ionicons
            name={rankIcons[index] as any}
            size={20}
            color={rankColor}
          />
        ) : (
          <Text
            style={[
              styles.rankNumber,
              { color: rankColor },
            ]}
          >
            #{index + 1}
          </Text>
        )}
      </View>

      {/* RANK TEXT FOR TOP 3 */}
      {isTop3 && (
        <Text
          style={[
            styles.topRank,
            { color: rankColor },
          ]}
        >
          #{index + 1}
        </Text>
      )}

      {/* RESTAURANT */}
      <Text
        style={styles.name}
        numberOfLines={1}
      >
        {item.restaurant}
      </Text>

      {/* POINTS */}
      <View style={styles.pointsRow}>
        <Ionicons
          name="star"
          size={13}
          color={COLORS.gold}
        />

        <Text style={styles.points}>
          {item.points} {t('points_short')}
        </Text>
      </View>

      {/* MEALS */}
      <View style={styles.mealsRow}>
        <Ionicons
          name="restaurant-outline"
          size={12}
          color={COLORS.textMuted}
        />

        <Text style={styles.meals}>
          {item.meals} {t('meals')}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    minHeight: 150,

    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,

    borderRadius: SIZES.radiusMd,

    backgroundColor: COLORS.surface,

    borderWidth: 1,
    borderColor: COLORS.border,

    ...SHADOWS.light,
  },

  topCard: {
    borderColor: '#E7D2A7',
  },

  rankCircle: {
    width: 42,
    height: 42,

    borderRadius: SIZES.radiusFull,

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: SPACING.xs,
  },

  rankNumber: {
    fontSize: 13,
    fontWeight: '800',
  },

  topRank: {
    fontSize: 11,
    fontWeight: '800',

    marginBottom: 3,
  },

  name: {
    maxWidth: 110,

    marginTop: 2,
    marginBottom: SPACING.sm,

    fontSize: 14,
    fontWeight: '800',

    color: COLORS.textMain,

    textAlign: 'center',
  },

  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',

    marginBottom: 3,
  },

  points: {
    marginLeft: 4,

    fontSize: 11,
    fontWeight: '800',

    color: COLORS.primary,

    letterSpacing: 0.2,
  },

  mealsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  meals: {
    marginLeft: 4,

    fontSize: 11,
    fontWeight: '600',

    color: COLORS.textMuted,
  },
});