// --- HISTORY CARD COMPONENT ---
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { styles } from '../styles';
import { COLORS } from '../../../../constants/theme';
import { useAuth } from '../../../../context/AuthContext';
import { toLangUpper } from '../../../../utils/text';

export interface HistoryItem {
  id: number;
  restaurant_name: string;
  // Pickup location (GET /api/student/history); any of these may be null
  restaurant_address?: string | null;
  lat?: number | null;
  lng?: number | null;
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
  const { lang } = useAuth();
  const isFree = item.type === 'free';
  const isPending = item.status === 'pending';
  const isValidated = item.status === 'validated';

  // Dynamic colors and text based on type
  const typeColor = isFree ? COLORS.success : COLORS.warningText;
  const typeLabel = toLangUpper(isFree ? t('free') : t('discount'), lang);

  // Dynamic colors and text based on status
  const cardBg = isPending ? COLORS.warningLight : (isValidated ? COLORS.successLight : COLORS.surfaceMuted);
  const statusColor = isPending ? COLORS.warningText : (isValidated ? COLORS.success : COLORS.textMuted);
  const badgeIcon = isPending ? 'time-outline' : (isValidated ? 'checkmark' : 'close');
  
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
      
      <View style={[styles.cardIconBox, { backgroundColor: COLORS.surface }]}>
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
           <Ionicons name={badgeIcon} size={20} color={COLORS.white} />
         </View>
         <Text style={[styles.statusLabelText, { color: statusColor }]}>
           {badgeText}
         </Text>
      </View>
    </TouchableOpacity>
  );
};