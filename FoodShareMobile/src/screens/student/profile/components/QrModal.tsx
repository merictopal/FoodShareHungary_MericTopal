import React from 'react';
import { View, Text, TouchableOpacity, Modal, TouchableWithoutFeedback } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Button } from '../../../../components/Button';
import { styles } from '../styles';

interface QrModalProps {
  visible: boolean;
  onClose: () => void;
  qrCode: string | null;
  t: any;
}

export const QrModal: React.FC<QrModalProps> = ({ visible, onClose, qrCode, t }) => {
  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('qr_title')}</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}>
                  <Text style={styles.closeIconText}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.qrContainer}>
                {qrCode && (
                  <QRCode value={qrCode} size={200} color="black" backgroundColor="transparent" />
                )}
              </View>
              <Text style={styles.modalInfo}>{t('msg_claim_success')}</Text>
              <Button title={t('close_btn')} onPress={onClose} style={styles.modalActionBtn} />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};