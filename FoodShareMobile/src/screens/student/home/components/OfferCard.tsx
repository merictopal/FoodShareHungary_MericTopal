import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Button } from '../../../../components/Button';
import { OfferTypeBadge } from '../../../../components/OfferTypeBadge';
import { styles } from '../styles';
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
  const typeColor = isFree ? COLORS.success : COLORS.warningText;
  const typeBgColor = isFree ? COLORS.successLight : COLORS.warningLight;

  return (
    <TouchableOpacity
      style={[styles.offerCard, { borderRadius: SIZES.radiusMd }]}
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

        {/* Wraps instead of space-between so long HU/TR badge labels never touch the stock text */}
        <View style={styles.tagsRow}>
          <OfferTypeBadge type={item.type} discountRate={item.discount_rate} />
          <Text style={styles.stockText}>{item.quantity} {t('left')}</Text>
        </View>
      </View>

      <View style={styles.cardAction}>
        {/* Same compact primary claim button as the recommended cards and map callouts */}
        <Button
          title={t('claim_btn')}
          onPress={() => onClaim(item.id, item.description)}
          size="sm"
        />
      </View>
    </TouchableOpacity>
  );
};
