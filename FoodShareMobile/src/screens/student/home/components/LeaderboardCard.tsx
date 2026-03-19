import React from 'react';
import { View, Text } from 'react-native';
import { styles } from '../styles';
import { COLORS } from '../../../../constants/theme';
import { LeaderboardEntry } from '../HomeScreen';

interface Props {
  item: LeaderboardEntry;
  index: number;
  t: any;
}

export const LeaderboardCard: React.FC<Props> = ({ item, index, t }) => {
  const isTop3 = index < 3;
  const rankColors = ['#F59E0B', '#9CA3AF', '#D97706']; 
  const rankColor = isTop3 ? rankColors[index] : COLORS.textSub;

  return (
    <View style={[styles.lbCard, isTop3 && styles.lbCardHighlight]}>
      <Text style={[styles.lbRank, { color: rankColor }]}>#{index + 1}</Text>
      <Text style={styles.lbName} numberOfLines={1}>{item.restaurant}</Text>
      <View style={styles.lbStats}>
        <Text style={styles.lbPoints}>{item.points} PTS</Text>
        <Text style={styles.lbMeals}>{item.meals} {t('meals')}</Text>
      </View>
    </View>
  );
};