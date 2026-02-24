import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator,
  TouchableWithoutFeedback
} from 'react-native';
import { COLORS, SHADOWS } from '../constants/theme';
import { client } from '../api/client'; // Adjust path if your client is elsewhere
import { useAuth } from '../context/AuthContext';

// --- INTERFACES ---
interface LeaderboardModalProps {
  visible: boolean;
  onClose: () => void;
}

interface LeaderboardEntry {
  restaurant: string;
  points: number;
  meals: number;
}

// --- MAIN COMPONENT ---
export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ visible, onClose }) => {
  const { t } = useAuth(); // Using translation engine
  
  // State Management
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch Leaderboard Data from Backend
  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      // Matches your Python backend route: @app.route('/api/leaderboard')
      const response = await client.get('/leaderboard');
      setLeaders(response.data);
    } catch (error) {
      console.error("Leaderboard fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Trigger fetch when modal becomes visible
  useEffect(() => {
    if (visible) {
      fetchLeaderboard();
    }
  }, [visible]);

  // Render individual list items
  const renderItem = ({ item, index }: { item: LeaderboardEntry, index: number }) => {
    // Determine medal colors for top 3
    let rankColor = COLORS.textSub;
    if (index === 0) rankColor = '#FFD700'; // Gold
    if (index === 1) rankColor = '#C0C0C0'; // Silver
    if (index === 2) rankColor = '#CD7F32'; // Bronze

    return (
      <View style={styles.entryCard}>
        <Text style={[styles.rankText, { color: rankColor }]}>#{index + 1}</Text>
        <View style={styles.infoContainer}>
          <Text style={styles.restaurantName} numberOfLines={1}>{item.restaurant}</Text>
          <Text style={styles.mealCount}>{item.meals} {t('meals_shared') || 'Meals Shared'}</Text>
        </View>
        <View style={styles.pointsContainer}>
          <Text style={styles.pointsText}>{item.points}</Text>
          <Text style={styles.xpText}>XP</Text>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalContent}>
              
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>🏆 {t('leaderboard') || 'Leaderboard'}</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Body */}
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
              ) : leaders.length === 0 ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.emptyText}>{t('no_data') || 'No data available yet.'}</Text>
                </View>
              ) : (
                <FlatList
                  data={leaders}
                  keyExtractor={(item, index) => index.toString()}
                  renderItem={renderItem}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.listContent}
                />
              )}

            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

// --- STYLES ---
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(31, 41, 51, 0.5)',
    justifyContent: 'flex-end', // Slides up from bottom
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    height: '70%', // Takes up bottom 70% of screen
    padding: 24,
    ...SHADOWS.heavy,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textMain,
  },
  closeBtn: {
    width: 32,
    height: 32,
    backgroundColor: '#F7F7F8',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textSub,
    marginTop: -2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textSub,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 40,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  rankText: {
    fontSize: 20,
    fontWeight: '900',
    width: 40,
  },
  infoContainer: {
    flex: 1,
    paddingRight: 10,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textMain,
    marginBottom: 4,
  },
  mealCount: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSub,
  },
  pointsContainer: {
    alignItems: 'flex-end',
  },
  pointsText: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.primary,
  },
  xpText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSub,
  }
});