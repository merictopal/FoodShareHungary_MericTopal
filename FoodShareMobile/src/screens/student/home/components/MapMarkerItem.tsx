import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Marker, Callout } from 'react-native-maps';
import { styles } from '../styles';
import { Offer } from '../HomeScreen';

interface Props {
  offer: Offer;
  onPressMap: (lat: number, lng: number) => void;
  onClaim: (id: number, desc: string) => void;
  t: any;
}

export const MapMarkerItem: React.FC<Props> = ({ offer, onPressMap, onClaim, t }) => {
  const isFree = offer.type === 'free';
  const markerText = isFree ? 'F' : 'D'; 
  
  return (
    <Marker
      coordinate={{ latitude: Number(offer.lat), longitude: Number(offer.lng) }}
      title={offer.restaurant}
      description={offer.description}
      onPress={() => onPressMap(Number(offer.lat), Number(offer.lng))}
    >
      <View style={[styles.customMarker, isFree ? styles.borderSuccess : styles.borderWarning]}>
        <Text style={[styles.markerText, isFree ? styles.textSuccess : styles.textWarning]}>{markerText}</Text>
      </View>

      <Callout tooltip onPress={() => onClaim(offer.id, offer.description)}>
        <View style={styles.calloutBubble}>
          <Text style={styles.calloutTitle}>{offer.restaurant}</Text>
          <Text style={styles.calloutDesc} numberOfLines={1}>{offer.description}</Text>
          <TouchableOpacity style={[styles.calloutBtn, isFree ? styles.bgSuccess : styles.bgWarning]} activeOpacity={0.8}>
            <Text style={styles.calloutBtnText}>{t('claim_btn')} ➤</Text>
          </TouchableOpacity>
        </View>
      </Callout>
    </Marker>
  );
};