import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';

interface OfferCardProps {
  item: any;
  onClaim: () => void;
  t: (key: string) => string;
}

export const OfferCard = ({ item, onClaim, t }: OfferCardProps) => {
  return (
    <View style={[styles.card, item.is_recommended && styles.recommended]}>
      {item.is_recommended && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>⭐ {t('recommended')}</Text>
        </View>
      )}

      <View style={styles.header}>
        <View style={styles.iconBox}><Text style={{fontSize:20}}>🍴</Text></View>
        <View style={{flex:1, marginLeft:12}}>
          <Text style={styles.restName}>{item.restaurant}</Text>
          <Text style={styles.dist}>📍 {item.distance} km</Text>
        </View>
        <View style={[styles.tag, { backgroundColor: item.type==='free' ? '#E1F7E9' : '#FFF3E0' }]}>
           <Text style={{ fontWeight:'800', fontSize:11, color: item.type==='free'?COLORS.success:COLORS.warning }}>
             {item.type==='free' ? t('free') : `-%${item.discount_rate}`}
           </Text>
        </View>
      </View>

      <View style={styles.divider} />
      <Text style={styles.desc}>{item.description}</Text>

      <View style={styles.footer}>
        <Text style={styles.stock}>🔥 {item.quantity} {t('left')}</Text>
        <TouchableOpacity style={styles.btn} onPress={onClaim}>
          <Text style={styles.btnText}>{t('claim_btn')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.surface, borderRadius: SIZES.radiusLg, padding: 16, marginBottom: 16, marginHorizontal: 20, ...SHADOWS.light },
  recommended: { borderWidth: 2, borderColor: COLORS.gold, backgroundColor: '#FFFEFA' },
  badge: { position: 'absolute', top: -10, right: 20, backgroundColor: COLORS.gold, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, ...SHADOWS.light, zIndex: 10 },
  badgeText: { fontSize: 10, fontWeight: '900', color: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.inputFill, alignItems: 'center', justifyContent: 'center' },
  restName: { fontSize: 16, fontWeight: '800', color: COLORS.textMain },
  dist: { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  desc: { fontSize: 15, color: COLORS.textMain, lineHeight: 22 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
  stock: { fontWeight: '700', color: COLORS.primary },
  btn: { backgroundColor: COLORS.secondary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 }
});