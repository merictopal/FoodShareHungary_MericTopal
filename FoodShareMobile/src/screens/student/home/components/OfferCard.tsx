import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Button } from '../../../../components/Button';
import { styles } from '../styles'; // Assuming you update styles.ts with new padding
import { COLORS, SIZES } from '../../../../constants/theme';
import { Offer } from '../HomeScreen';

interface Props {
  item: Offer;
  onPressMap: (lat: number, lng: number) => void;
  onClaim: (id: number, desc: string) => void;
  t: any;
}

export const OfferCard: React.FC<Props> = ({ item, onPressMap, onClaim, t }) => {
  const isFree = item.type === 'free';
  const typeColor = isFree ? COLORS.success : COLORS.warning; // Teal for free, Amber for discount
  const typeBgColor = isFree ? '#ECFDF5' : '#FEF3C7'; 

  return (
    <TouchableOpacity 
      style={[styles.offerCard, { borderRadius: SIZES.radiusMd }]} // 🚀 NEW: Softer corners
      activeOpacity={0.7} 
      onPress={() => onPressMap(Number(item.lat), Number(item.lng))}
    >
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.cardIconImage} />
      ) : (
        <View style={[styles.cardIconBox, { backgroundColor: typeBgColor, borderRadius: SIZES.radius }]}>
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
          
          {/* 🚀 NEW: Urgency Badge to create psychological prompt */}
          <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 }}>
            <Text style={{ fontSize: 9, color: COLORS.danger, fontWeight: '800' }}>URGENT</Text>
          </View>
        </View>
      </View>

      <View style={styles.cardAction}>
         {/* 🚀 FIXED: Custom styling to ensure 'CLAIM' text never overflows */}
         <Button 
           title={t('claim_btn')} 
           onPress={() => onClaim(item.id, item.description)} 
           // Overriding base button height and padding for this specific card
           style={{ height: 36, paddingHorizontal: 12, minWidth: 80, borderRadius: SIZES.radiusSm, backgroundColor: COLORS.success }} 
           textStyle={{ fontSize: 12, fontWeight: '900', letterSpacing: 0.5, color: COLORS.white }} 
           variant="primary" // Overridden by inline style backgroundColor
         />
      </View>
    </TouchableOpacity>
  );
};