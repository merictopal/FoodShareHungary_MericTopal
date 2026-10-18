import React from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { styles } from '../styles';
import { COLORS } from '../../../../constants/theme';
import { BottomSheet } from '../../../../components/BottomSheet';
import { EmptyState } from '../../../../components/EmptyState';

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
  notifications: any[];
  // True while the inbox request is in flight, so "no notifications" isn't shown prematurely
  loading?: boolean;
  t: any;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({ visible, onClose, notifications, loading = false, t }) => {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('notifications')}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.notifScrollView}>
        {loading ? (
          <View style={styles.notifLoadingBox}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.notifTime}>{t('loading')}</Text>
          </View>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon="notifications-off-outline"
            title={t('no_notifications')}
            style={styles.notifEmpty}
          />
        ) : (
          notifications.map((notif) => (
            <View key={notif.id} style={styles.notifCard}>
              <View style={styles.notifTextContainer}>
                <Text style={styles.notifTitle}>{notif.title}</Text>
                <Text style={styles.notifBody}>{notif.body}</Text>
                <Text style={styles.notifTime}>{notif.time}</Text>
              </View>
              {notif.unread && <View style={styles.notifUnreadDot} />}
            </View>
          ))
        )}
      </ScrollView>
    </BottomSheet>
  );
};
