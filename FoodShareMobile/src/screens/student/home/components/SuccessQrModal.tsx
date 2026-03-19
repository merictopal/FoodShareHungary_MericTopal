import React from 'react';
import { View, Text, Modal, TouchableWithoutFeedback } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Button } from '../../../../components/Button';
import { styles } from '../styles';

interface Props {
  visible: boolean;
  onClose: () => void;
  qrCode: string | null;
  t: any;
}

export const SuccessQrModal: React.FC<Props> = ({ visible, onClose, qrCode, t }) => {
  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitleSuccess}>{t('success')}!</Text>
              <Text style={styles.modalInfoText}>{t('order_created')}</Text>
              <View style={styles.qrCodeWrapper}>
                {qrCode && <QRCode value={qrCode} size={200} color="black" backgroundColor="transparent" />}
              </View>
              <Button title={t('close_btn')} onPress={onClose} style={{ width: '100%' }} />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};