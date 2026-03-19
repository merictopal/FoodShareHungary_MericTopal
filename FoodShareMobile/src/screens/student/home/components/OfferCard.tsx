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

export const OfferCard: React.FC<Props> = ({ item, onPressMap, onClaim, t }) => {
  const isFree = item.type === 'free';
  const typeColor = isFree ? COLORS.success : COLORS.warning;
  const typeBgColor = isFree ? '#ECFDF5' : '#FEF3C7'; 

  return (
    <TouchableOpacity style={styles.offerCard} activeOpacity={0.7} onPress={() => onPressMap(Number(item.lat), Number(item.lng))}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.cardIconImage} />
      ) : (
        <View style={[styles.cardIconBox, { backgroundColor: typeBgColor }]}>
          <Text style={[styles.cardIconLetter, { color: typeColor }]}>{item.restaurant.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.cardInfo}>
        <View style={styles.cardHeaderRow}>
           <Text style={styles.cardTitle}>{item.restaurant}</Text>
           {item.distance !== undefined && <Text style={styles.distText}>{item.distance} {t('dist_km')}</Text>}
        </View>
        <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>
        <View style={styles.tagsRow}>
          <View style={[styles.tagBadge, { backgroundColor: typeBgColor }]}>
            <Text style={[styles.tagText, { color: typeColor }]}>
              {isFree ? t('free').toUpperCase() : `${item.discount_rate}% ${t('discount').toUpperCase()}`}
            </Text>
          </View>
          <Text style={styles.stockText}>{item.quantity} {t('left')}</Text>
        </View>
      </View>
      <View style={styles.cardAction}>
         <Button 
           title={t('claim_btn')} onPress={() => onClaim(item.id, item.description)} 
           style={styles.miniBtn} textStyle={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }} variant={isFree ? 'success' : 'primary'}
         />
      </View>
    </TouchableOpacity>
  );
};