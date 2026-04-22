import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Button } from '../../../../components/Button';
import { COLORS, SIZES, SHADOWS } from '../../../../constants/theme';
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
    <TouchableOpacity 
      // 🚀 FIXED: Explicit width prevents the card from being squished in the horizontal list
      style={{
        width: 260, 
        backgroundColor: COLORS.surface,
        borderRadius: SIZES.radiusMd,
        padding: 16,
        marginRight: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.light
      }} 
      activeOpacity={0.8} 
      onPress={() => onPressMap(Number(item.lat), Number(item.lng))}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={{ width: 40, height: 40, borderRadius: 8, marginRight: 12 }} />
        ) : (
          <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: typeBgColor, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
            <Text style={{ color: typeColor, fontWeight: 'bold', fontSize: 18 }}>{item.restaurant.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.textMain, marginBottom: 2 }} numberOfLines={1}>{item.restaurant}</Text>
          <Text style={{ fontSize: 12, color: COLORS.textSub }} numberOfLines={1}>{item.description}</Text>
        </View>
      </View>
      
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ backgroundColor: typeBgColor, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: typeColor }}>
            {isFree ? t('free').toUpperCase() : `${item.discount_rate}% ${t('discount').toUpperCase()}`}
          </Text>
        </View>
        
        <Button 
          title={t('claim_btn')} 
          onPress={() => onClaim(item.id, item.description)} 
          style={{ height: 32, paddingHorizontal: 16, borderRadius: SIZES.radiusSm, backgroundColor: COLORS.success, marginBottom: 0 }} 
          textStyle={{ fontSize: 11, fontWeight: '800', color: COLORS.white }} 
          variant="primary"
        />
      </View>
    </TouchableOpacity>
  );
};