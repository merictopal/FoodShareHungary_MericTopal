import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Button } from '../../../../components/Button';
import { styles } from '../styles';
import { COLORS } from '../../../../constants/theme';
import { Offer } from '../HomeScreen';

interface Props {
  item: Offer;
  onPressMap: (lat: number, lng: number) => void;
  onClaim: (id: number, desc: string) => void;
  t: any;
}

export const RecommendedCard: React.FC<Props> = ({ item, onPressMap, onClaim, t }) => {
  const isFree = item.type === 'free';
  const typeColor = isFree ? COLORS.success : COLORS.warning;
  const typeBgColor = isFree ? '#ECFDF5' : '#FEF3C7';

  return (
    <TouchableOpacity style={styles.aiCard} activeOpacity={0.7} onPress={() => onPressMap(Number(item.lat), Number(item.lng))}>
      <View style={styles.aiCardHeader}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.aiImage} />
        ) : (
          <View style={[styles.aiIconBox, { backgroundColor: typeBgColor }]}>
            <Text style={[styles.aiIconLetter, { color: typeColor }]}>{item.restaurant.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.aiInfo}>
          <Text style={styles.aiTitle} numberOfLines={1}>{item.restaurant}</Text>
          <Text style={styles.aiDesc} numberOfLines={1}>{item.description}</Text>
        </View>
      </View>
      <View style={styles.aiFooter}>
        <View style={[styles.tagBadge, { backgroundColor: typeBgColor }]}>
           <Text style={[styles.tagText, { color: typeColor }]}>
             {isFree ? t('free').toUpperCase() : `${item.discount_rate}% ${t('discount').toUpperCase()}`}
           </Text>
        </View>
        <Button 
           title={t('claim_btn')} onPress={() => onClaim(item.id, item.description)} 
           style={styles.aiClaimBtn} textStyle={{ fontSize: 10, fontWeight: '800' }} variant={isFree ? 'success' : 'primary'}
         />
      </View>
    </TouchableOpacity>
  );
};