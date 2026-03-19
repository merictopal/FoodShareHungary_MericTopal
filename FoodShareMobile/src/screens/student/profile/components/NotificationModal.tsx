import React from 'react';
import { View, Text, TouchableOpacity, Modal, TouchableWithoutFeedback, ScrollView } from 'react-native';
import { styles } from '../styles';

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
  notifications: any[];
  t: any;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({ visible, onClose, notifications, t }) => {
  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.notifModalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('notifications').toUpperCase()}</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}>
                  <Text style={styles.closeIconText}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} style={styles.notifScrollView}>
                {notifications.map((notif) => (
                  <View key={notif.id} style={styles.notifCard}>
                    <View style={styles.notifTextContainer}>
                      <Text style={styles.notifTitle}>{notif.title}</Text>
                      <Text style={styles.notifBody}>{notif.body}</Text>
                      <Text style={styles.notifTime}>{notif.time}</Text>
                    </View>
                    {notif.unread && <View style={styles.notifUnreadDot} />}
                  </View>
                ))}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};