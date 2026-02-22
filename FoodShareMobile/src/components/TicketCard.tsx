import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { COLORS, SHADOWS, SIZES } from '../constants/theme';

interface TicketProps {
  qrData: string;
  title: string;
  subtitle: string;
  onClose: () => void;
  btnText: string;
}

export const TicketCard = ({ qrData, title, subtitle, onClose, btnText }: TicketProps) => {
  return (
    <View style={styles.wrapper}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brand}>FOODSHARE TICKET</Text>
        {}
        <View style={[styles.hole, styles.holeLeft]} />
        <View style={[styles.hole, styles.holeRight]} />
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{subtitle}</Text>
        
        <View style={styles.qrContainer}>
           <Image 
             source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${qrData}` }} 
             style={styles.qr}
             resizeMode="contain"
           />
        </View>
        
        <Text style={styles.code}>{qrData}</Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.btn} onPress={onClose}>
          <Text style={styles.btnText}>{btnText}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { width: '85%', alignSelf: 'center', borderRadius: 20, overflow: 'hidden', ...SHADOWS.medium },
  header: { backgroundColor: COLORS.primary, padding: 20, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'rgba(255,255,255,0.3)', borderStyle: 'dashed' },
  brand: { color: '#FFF', fontWeight: '900', letterSpacing: 3, fontSize: 16 },
  hole: { position: 'absolute', bottom: -15, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.6)' },
  holeLeft: { left: -15 },
  holeRight: { right: -15 },
  body: { backgroundColor: '#FFF', padding: 25, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.secondary, textAlign: 'center', marginBottom: 5 },
  sub: { fontSize: 13, color: COLORS.textSub, marginBottom: 20, textAlign: 'center' },
  qrContainer: { padding: 10, backgroundColor: '#FFF', borderRadius: 15, ...SHADOWS.light, marginBottom: 15 },
  qr: { width: 180, height: 180 },
  code: { fontSize: 18, fontWeight: '700', letterSpacing: 2, color: COLORS.secondary },
  footer: { backgroundColor: '#FFF', padding: 20, paddingTop: 0 },
  btn: { backgroundColor: COLORS.secondary, padding: 15, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: 'bold', letterSpacing: 1 }
});