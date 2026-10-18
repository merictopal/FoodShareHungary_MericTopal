import React from 'react';
import { View, Text } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Button } from '../../../../components/Button';
import { BottomSheet } from '../../../../components/BottomSheet';
import { PickupLocation } from '../../../../components/PickupLocation';
import type { HistoryItem } from './HistoryCard';
import { COLORS } from '../../../../constants/theme';
import { styles } from '../styles';

interface QrModalProps {
  visible: boolean;
  onClose: () => void;
  qrCode: string | null;
  // History item of the shown QR, for the pickup location
  item?: HistoryItem | null;
  t: any;
}

// Same QR value, size and close behaviour as before; only the frame changed: the code is now
// drawn on white (it was transparent on a grey card, which lowered scan contrast).
export const QrModal: React.FC<QrModalProps> = ({ visible, onClose, qrCode, item, t }) => {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('qr_title')}>
      <View style={styles.qrContainer}>
        {qrCode && (
          <QRCode value={qrCode} size={200} color="black" backgroundColor={COLORS.white} />
        )}
      </View>
      <Text style={styles.modalInfo}>{t('msg_claim_success')}</Text>
      {item && (
        <PickupLocation
          name={item.restaurant_name}
          address={item.restaurant_address}
          lat={item.lat}
          lng={item.lng}
          t={t}
        />
      )}
      <Button title={t('close_btn')} onPress={onClose} style={styles.modalActionBtn} />
    </BottomSheet>
  );
};
