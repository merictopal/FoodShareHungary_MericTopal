// --- HISTORY CARD COMPONENT ---
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styles } from '../styles';

export interface HistoryItem {
  id: number;
  restaurant_name: string;
  offer_title: string;
  type: 'free' | 'discount';
  date: string;
  qr_code: string;
  status: string;
}

interface HistoryCardProps {
  item: HistoryItem;
  onPress: () => void;
  t: any;
}

export const HistoryCard: React.FC<HistoryCardProps> = ({ item, onPress, t }) => {
  const isFree = item.type === 'free';
  const isPending = item.status === 'pending';
  const isValidated = item.status === 'validated';

  // Dynamic colors and text based on type
  const typeColor = isFree ? '#2ECC71' : '#F39C12'; 
  const typeLabel = isFree ? t('free').toUpperCase() : t('discount').toUpperCase();

  // Dynamic colors and text based on status
  const cardBg = isPending ? '#FFF8E1' : (isValidated ? '#E8F5E9' : '#F5F5F5');
  const statusColor = isPending ? '#F5B041' : (isValidated ? '#2ECC71' : '#95A5A6');
  const badgeIcon = isPending ? '🕒' : (isValidated ? '✓' : '✖');
  
  // Use translations for status badges
  let badgeText = t('status_cancelled');
  if (isPending) {
    badgeText = t('status_pending');
  }
  if (isValidated) {
    badgeText = t('status_validated');
  }

  return (
    <TouchableOpacity 
      style={[styles.historyCard, { backgroundColor: cardBg }]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.cardStrip, { backgroundColor: typeColor }]} />
      
      <View style={[styles.cardIconBox, { backgroundColor: '#FFFFFF' }]}>
         <Text style={[styles.cardIconLetter, { color: typeColor }]}>
           {isFree ? 'F' : 'D'}
         </Text>
      </View>

      <View style={styles.cardContent}>
         <Text style={styles.restName} numberOfLines={1}>
           {item.restaurant_name}
         </Text>
         <Text style={styles.offerName} numberOfLines={1}>
           {item.offer_title}
         </Text>
         
         <View style={styles.typeLabelRow}>
           <View style={[styles.typeIndicatorDot, { backgroundColor: typeColor }]} />
           <Text style={[styles.typeLabelText, { color: typeColor }]}>
             {typeLabel}
           </Text>
           <Text style={styles.dateLabelText}>
             • {item.date}
           </Text>
         </View>
      </View>

      <View style={styles.cardAction}>
         <View style={[styles.statusCircle, { backgroundColor: statusColor }]}>
           <Text style={styles.statusCircleIcon}>
             {badgeIcon}
           </Text>
         </View>
         <Text style={[styles.statusLabelText, { color: statusColor }]}>
           {badgeText}
         </Text>
      </View>
    </TouchableOpacity>
  );
};