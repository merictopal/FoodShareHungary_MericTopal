import React, { useState, useCallback, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, RefreshControl, 
  TouchableOpacity, ActivityIndicator, Alert, FlatList, Modal 
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { client } from '../../api/client';
import { COLORS, SIZES, SHADOWS } from '../../constants/theme';
import { Header } from '../../components/Header';
import { Button } from '../../components/Button';

// --- COMPONENTS ---

// Minimalist, emoji-free Stat Card component focusing on typography and color
const StatCard = ({ title, value, color, letterPrefix }: any) => (
  <View style={[styles.statCard, { borderTopColor: color }]}>
    <View style={styles.statHeader}>
      {/* Replaced emoji with a professional typographic badge */}
      <View style={[styles.iconBadge, { backgroundColor: color + '1A' }]}>
        <Text style={[styles.iconLetter, { color }]}>{letterPrefix}</Text>
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
    <Text style={styles.statTitle}>{title}</Text>
  </View>
);

const AdminPanelScreen = () => {
  // --- HOOKS & CONTEXT ---
  const { t, logout, lang, changeLanguage } = useAuth();
  
  // --- STATE MANAGEMENT ---
  const [stats, setStats] = useState<any>({
    total_users: 0,
    total_restaurants: 0,
    active_offers: 0,
    total_claims: 0
  });
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [langModalVisible, setLangModalVisible] = useState(false); // Controls the language switcher modal

  // --- DATA FETCHING ---
  const fetchDashboardData = async () => {
    try {
      const [statsRes, pendingRes] = await Promise.all([
        client.get('/admin/stats'),
        client.get('/admin/pending')
      ]);

      setStats(statsRes.data);
      setPendingUsers(pendingRes.data);
    } catch (error) {
      console.error("Admin dashboard data fetch error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial data load
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Pull-to-refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData();
  }, []);

  // --- ACTIONS ---
  const handleApprove = async (userId: number, name: string) => {
    try {
      await client.post('/admin/approve', { user_id: userId });
      // Notify success using translation variables if supported, or generic success
      Alert.alert(t('success'), `${name} has been approved.`);
      fetchDashboardData(); // Refresh list after approval
    } catch (error) {
      Alert.alert(t('error'), "Approval operation failed.");
    }
  };

  const switchLanguage = async (newLang: string) => {
    await changeLanguage(newLang);
    setLangModalVisible(false);
  };

  const handleLogout = () => {
    Alert.alert(t('logout'), "Are you sure you want to log out?", [
      { text: t('cancel'), style: 'cancel' },
      { text: t('logout'), style: 'destructive', onPress: logout }
    ]);
  };

  // --- RENDERERS ---
  const renderPendingItem = ({ item }: { item: any }) => {
    // Determine dynamic strings without using emojis
    const isRestaurant = item.type === 'restaurant';
    const roleText = isRestaurant ? t('role_rest') : t('role_student');
    const roleColor = isRestaurant ? COLORS.warning : COLORS.primary;
    
    // Fallback for new users missing joined_at
    const joinDate = item.joined_at || "NEW"; 
    
    // Clean, professional detail text
    const detailText = isRestaurant 
      ? `${t('role_rest')}: ${item.detail}` 
      : `📄 Document Uploaded`;

    return (
      <View style={styles.pendingCard}>
        <View style={styles.pendingInfo}>
          <View style={styles.pendingHeader}>
            <Text style={[styles.userRole, { color: roleColor, backgroundColor: roleColor + '1A' }]}>
              {roleText.toUpperCase()}
            </Text>
            <Text style={styles.dateBadge}>{joinDate}</Text>
          </View>
          
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          
          {item.detail && (
            <Text style={styles.userDetail}>{detailText}</Text>
          )}
        </View>

        <View style={styles.actions}>
          <Button 
            title={t('approve')} 
            onPress={() => handleApprove(item.user_id, item.name)}
            variant="success"
            style={styles.approveBtn}
            textStyle={styles.approveBtnText}
          />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with Language Switcher Icon (Globe) instead of Door emoji */}
      <Header 
        title={t('nav_admin')} 
        rightIcon="🌐" 
        onRightPress={() => setLangModalVisible(true)} 
      />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* STATS SECTION */}
        <Text style={styles.sectionTitle}>{t('stats')}</Text>
        <View style={styles.grid}>
          <StatCard 
            title={t('users')} 
            value={stats.total_users} 
            letterPrefix="U" 
            color={COLORS.primary} 
          />
          <StatCard 
            title={t('active_offers')} 
            value={stats.active_offers} 
            letterPrefix="O" 
            color={COLORS.warning} 
          />
          <StatCard 
            title={t('role_rest')} // Re-using translation
            value={stats.total_restaurants} 
            letterPrefix="R" 
            color={COLORS.secondary} 
          />
          <StatCard 
            title={t('total_claims')} 
            value={stats.total_claims} 
            letterPrefix="M" // Meals
            color={COLORS.success} 
          />
        </View>

        {/* PENDING APPROVALS SECTION */}
        <View style={styles.sectionHeaderRow}>
           <Text style={styles.sectionTitle}>{t('pending_approvals')}</Text>
           <View style={styles.countBadge}>
              <Text style={styles.countText}>{pendingUsers.length}</Text>
           </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : (
          pendingUsers.length > 0 ? (
            <FlatList
              data={pendingUsers}
              renderItem={renderPendingItem}
              keyExtractor={(item) => item.user_id.toString()}
              scrollEnabled={false} // Disabled because it's inside a ScrollView
            />
          ) : (
            // Professional Empty State without emojis
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                 <Text style={styles.emptyIconText}>✓</Text>
              </View>
              <Text style={styles.emptyText}>{t('no_pending')}</Text>
            </View>
          )
        )}
        
        {/* LOGOUT BUTTON (Placed at the bottom for better UX) */}
        <View style={styles.footer}>
           <Button 
             title={t('logout')} 
             onPress={handleLogout} 
             variant="secondary"
             style={styles.logoutBtn}
             textStyle={styles.logoutText}
           />
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* --- LANGUAGE SELECTION MODAL --- */}
      <Modal
        visible={langModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setLangModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('lang_change')}</Text>
            
            <TouchableOpacity style={[styles.langBtn, lang === 'en' && styles.langBtnActive]} onPress={() => switchLanguage('en')}>
               <Text style={[styles.langText, lang === 'en' && styles.langTextActive]}>🇬🇧 English</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.langBtn, lang === 'tr' && styles.langBtnActive]} onPress={() => switchLanguage('tr')}>
               <Text style={[styles.langText, lang === 'tr' && styles.langTextActive]}>🇹🇷 Türkçe</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.langBtn, lang === 'hu' && styles.langBtnActive]} onPress={() => switchLanguage('hu')}>
               <Text style={[styles.langText, lang === 'hu' && styles.langTextActive]}>🇭🇺 Magyar</Text>
            </TouchableOpacity>

            <Button title={t('close_btn')} onPress={() => setLangModalVisible(false)} style={{ marginTop: 20, width: '100%' }} />
          </View>
        </View>
      </Modal>
    </View>
  );
};

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: 20 },
  
  // Typography
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: '800', 
    color: COLORS.textMain, 
    marginBottom: 15,
    letterSpacing: 0.5 
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 25,
    marginBottom: 5,
  },
  countBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 10,
    marginBottom: 10, // Alignment fix
  },
  countText: { color: 'white', fontSize: 12, fontWeight: 'bold' },

  // Grid & Stat Cards
  grid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between' 
  },
  statCard: { 
    width: '48%', 
    backgroundColor: COLORS.surface, 
    padding: 16, 
    borderRadius: 16, 
    marginBottom: 16,
    borderTopWidth: 4, // Changed from left border to top border for a sleeker look
    ...SHADOWS.light
  },
  statHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  iconBadge: {
    width: 32, height: 32, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center'
  },
  iconLetter: { fontSize: 16, fontWeight: '900' },
  statValue: { fontSize: 24, fontWeight: '900' },
  statTitle: { fontSize: 12, color: COLORS.textSub, fontWeight: '700', textTransform: 'uppercase' },

  // Pending Cards
  pendingCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...SHADOWS.light
  },
  pendingInfo: { flex: 1, marginRight: 10 },
  pendingHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  userRole: { 
    fontSize: 10, 
    fontWeight: '900', 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 6,
    overflow: 'hidden',
    marginRight: 10
  },
  dateBadge: { fontSize: 10, color: COLORS.textSub, fontWeight: '600' },
  userName: { fontSize: 15, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 2 },
  userEmail: { fontSize: 13, color: COLORS.textSub, marginBottom: 6 },
  userDetail: { fontSize: 11, color: COLORS.secondary, fontStyle: 'italic', fontWeight: '500' },
  
  // Actions
  actions: { justifyContent: 'center' },
  approveBtn: { height: 38, paddingHorizontal: 16, borderRadius: 10 },
  approveBtnText: { fontSize: 12, fontWeight: 'bold' },

  // Empty State (Professional look)
  emptyState: { 
    alignItems: 'center', 
    padding: 40, 
    backgroundColor: '#FAFAFA', 
    borderRadius: 16, 
    borderStyle: 'dashed', 
    borderWidth: 1.5, 
    borderColor: '#E0E0E0',
    marginTop: 10
  },
  emptyIconCircle: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12
  },
  emptyIconText: { fontSize: 24, color: COLORS.success, fontWeight: 'bold' },
  emptyText: { color: COLORS.textSub, fontWeight: '500' },

  // Footer (Logout)
  footer: { marginTop: 40 },
  logoutBtn: { backgroundColor: '#FFEBEE', borderWidth: 0, borderRadius: 12 },
  logoutText: { color: '#D32F2F', fontWeight: 'bold' },

  // Modal Styles
  modalOverlay: { 
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'flex-end' // Slides from bottom like an Action Sheet
  },
  modalContent: { 
    backgroundColor: 'white', 
    borderTopLeftRadius: 24, borderTopRightRadius: 24, 
    padding: 25, alignItems: 'center', 
    ...SHADOWS.medium 
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 20 },
  langBtn: {
    width: '100%', padding: 16, borderRadius: 12,
    backgroundColor: '#F5F5F5', marginBottom: 10,
    alignItems: 'center', borderWidth: 1, borderColor: '#EEEEEE'
  },
  langBtnActive: { backgroundColor: '#E3F2FD', borderColor: COLORS.primary },
  langText: { fontSize: 15, fontWeight: '600', color: COLORS.textMain },
  langTextActive: { color: COLORS.primary, fontWeight: 'bold' },
});

export default AdminPanelScreen;