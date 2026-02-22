import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';

export const OfferCard = ({ item, t, onClaim }: any) => (
  <View style={[styles.card, item.is_recommended && styles.cardFeatured]}>
    {item.is_recommended && (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>⭐ {t('recommended') || 'ÖNERİLEN'}</Text>
      </View>
    )}
    
    <View style={styles.row}>
      <View style={styles.iconBox}><Text style={{fontSize: 22}}>🍴</Text></View>
      <View style={{flex: 1, marginLeft: 12}}>
        <Text style={styles.title}>{item.restaurant}</Text>
        <Text style={styles.sub}>{item.distance} km</Text>
      </View>
      <View style={[styles.tag, {backgroundColor: item.type === 'free' ? '#E1F7E9' : '#FFF3E0'}]}>
        <Text style={{
          fontSize: 11, fontWeight: 'bold', 
          color: item.type === 'free' ? COLORS.success : COLORS.warning
        }}>
          {item.type === 'free' ? (t('free')||'BEDAVA') : `-%${item.discount_rate}`}
        </Text>
      </View>
    </View>

    <View style={styles.divider} />
    <Text style={styles.desc}>{item.description}</Text>

    <View style={[styles.row, {marginTop: 15}]}>
      <Text style={{color: COLORS.primary, fontWeight: '700'}}>
        🔥 {item.quantity} {t('items_left') || 'adet'}
      </Text>
      <TouchableOpacity style={styles.claimBtn} onPress={() => onClaim(item.id)}>
        <Text style={{color: '#FFF', fontWeight: 'bold', fontSize: 12}}>
          {t('btn_claim') || 'AL'}
        </Text>
      </TouchableOpacity>
    </View>
  </View>
);

export const StatCard = ({ title, value, icon, color }: any) => (
  <View style={[styles.statCard, { borderBottomColor: color }]}>
    <Text style={{fontSize: 24, marginBottom: 5}}>{icon}</Text>
    <Text style={[styles.statValue, {color}]}>{value}</Text>
    <Text style={styles.statTitle}>{title}</Text>
  </View>
);

export const ListItem = ({ title, subtitle, date, status, onPress, actionText, icon }: any) => (
  <View style={styles.listItem}>
    <View style={styles.listIcon}><Text style={{fontSize: 20}}>{icon || '📄'}</Text></View>
    <View style={{flex: 1, marginHorizontal: 12}}>
      <Text style={styles.listTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.listSub}>{subtitle} {date ? `• ${date}` : ''}</Text>
    </View>
    {status ? (
      <Text style={{color: COLORS.success, fontWeight: 'bold', fontSize: 12}}>{status}</Text>
    ) : (
      actionText && (
        <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
          <Text style={{color: '#FFF', fontWeight: 'bold', fontSize: 11}}>{actionText}</Text>
        </TouchableOpacity>
      )
    )}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusLg,
    padding: 16,
    marginBottom: 16,
    marginHorizontal: 20,
    ...SHADOWS.light
  },
  cardFeatured: {
    borderWidth: 2,
    borderColor: COLORS.gold,
    backgroundColor: '#FFFEFA'
  },
  badge: {
    position: 'absolute', top: -12, right: 20,
    backgroundColor: COLORS.gold,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, zIndex: 10, ...SHADOWS.light
  },
  badgeText: { fontSize: 10, fontWeight: '900', color: '#FFF' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.inputFill, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '800', color: COLORS.textMain },
  sub: { fontSize: 12, color: COLORS.textSub },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  desc: { fontSize: 15, color: COLORS.textMain, lineHeight: 22 },
  claimBtn: { backgroundColor: COLORS.secondary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  
  statCard: {
    width: '47%',
    backgroundColor: COLORS.surface,
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderBottomWidth: 4,
    ...SHADOWS.light
  },
  statValue: { fontSize: 24, fontWeight: 'bold' },
  statTitle: { fontSize: 11, fontWeight: '700', color: COLORS.textSub, marginTop: 2 },

  listItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 15, borderRadius: 12, marginBottom: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border
  },
  listIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.inputFill, alignItems: 'center', justifyContent: 'center' },
  listTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textMain },
  listSub: { fontSize: 11, color: COLORS.textSub, marginTop: 3 },
  actionBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }
});