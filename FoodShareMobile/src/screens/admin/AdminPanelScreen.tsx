import React, { useState, useCallback, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, RefreshControl, 
  TouchableOpacity, ActivityIndicator, Alert, FlatList, Modal, Image 
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import { toLangUpper } from '../../utils/text';
import { client } from '../../api/client';
import { COLORS, SIZES, SHADOWS } from '../../constants/theme';
import { Header } from '../../components/Header';
import { Button } from '../../components/Button';

// --- COMPONENTS ---

// Minimalist, emoji-free Stat Card component focusing on typography and color
const StatCard = ({ title, value, color, letterPrefix }: any) => (
  <View style={[styles.statCard, { borderTopColor: color }]}>
    <View style={styles.statHeader}>
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
  
  // Separate states for the two lists
  const [pendingRestaurants, setPendingRestaurants] = useState<any[]>([]);
  const [pendingStudents, setPendingStudents] = useState<any[]>([]);
  
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [docModalVisible, setDocModalVisible] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);

  // --- DATA FETCHING ---
  const fetchDashboardData = async () => {
    try {
      const [statsRes, pendingRes] = await Promise.all([
        client.get('/admin/stats'),
        client.get('/admin/pending')
      ]);

      setStats(statsRes.data);
      
      // Split the incoming data into two separate arrays based on user role
      const allPending = pendingRes.data || [];
      setPendingRestaurants(allPending.filter((u: any) => u.type === 'restaurant'));
      setPendingStudents(allPending.filter((u: any) => u.type === 'student'));
      
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
      Alert.alert(t('success'), t('user_approved', { name }));
      fetchDashboardData(); // Refresh lists after approval
    } catch (error) {
      Alert.alert(t('error'), t('approve_failed'));
    }
  };
  
  const handleReject = async (userId: number, name: string) => {
    Alert.alert(
      t('reject_doc_title'),
      t('reject_doc_msg', { name }),
      [
        { text: t('cancel'), style: "cancel" },
        { 
          text: t('reject'), 
          style: "destructive",
          onPress: async () => {
            try {
              await client.post('/admin/reject', { user_id: userId });
              Alert.alert(t('rejected'), t('user_rejected', { name }));
              fetchDashboardData(); 
            } catch (error) {
              Alert.alert(t('error'), t('reject_failed'));
            }
          }
        }
      ]
    );
  };

  const handleViewDocument = (docUrl: string) => {
    if (!docUrl) {
      Alert.alert(t('doc_not_found_title'), t('doc_not_found_msg'));
      return;
    }
    setSelectedDoc(docUrl);
    setDocModalVisible(true);
  };

  const switchLanguage = async (newLang: string) => {
    await changeLanguage(newLang);
    setLangModalVisible(false);
  };

  const handleLogout = () => {
    Alert.alert(t('logout'), t('logout_confirm_msg'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('logout'), style: 'destructive', onPress: logout }
    ]);
  };

  // --- RENDERERS ---
  const renderPendingItem = ({ item }: { item: any }) => {
    const isRestaurant = item.type === 'restaurant';
    const roleText = isRestaurant ? t('role_rest') : t('role_student');
    const roleColor = isRestaurant ? COLORS.warning : COLORS.primary;
    
    // Fallback for new users missing joined_at
    const joinDate = item.joined_at || t('badge_new');
    
    // Clean, professional detail text
    const detailText = isRestaurant 
      ? item.detail
      : t('id_doc_uploaded');

    return (
      <View style={styles.pendingCard}>
        <View style={styles.pendingInfo}>
          <View style={styles.pendingHeader}>
            <Text style={[styles.userRole, { color: roleColor, backgroundColor: roleColor + '1A' }]}>
              {toLangUpper(roleText, lang)}
            </Text>
            <Text style={styles.dateBadge}>{joinDate}</Text>
          </View>
          
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          
          {item.detail && (
            <Text style={styles.userDetail}>{detailText}</Text>
          )}

          {/* Document Viewer Button (Only for students with uploaded docs) */}
          {!isRestaurant && item.doc && (
            <TouchableOpacity 
              style={styles.viewDocBtn} 
              onPress={() => handleViewDocument(item.doc)}
              activeOpacity={0.7}
            >
              <Ionicons name="document-text-outline" size={14} color={COLORS.textMain} />
              <Text style={styles.viewDocText}>{t('view_document')}</Text>
            </TouchableOpacity>
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
          <Button 
            title={t('reject')} 
            onPress={() => handleReject(item.user_id, item.name)}
            variant="dangerSoft"
            style={styles.rejectBtn}
            textStyle={styles.rejectBtnText}
          />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with Language Switcher Icon */}
      <Header 
        title={t('nav_admin')} 
        rightIcon="globe-outline" 
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
            title={toLangUpper(t('users'), lang)} 
            value={stats.total_users} 
            letterPrefix="U" 
            color={COLORS.primary} 
          />
          <StatCard 
            title={toLangUpper(t('active_offers'), lang)} 
            value={stats.active_offers} 
            letterPrefix="O" 
            color={COLORS.warning} 
          />
          <StatCard 
            title={toLangUpper(t('role_rest'), lang)} 
            value={stats.total_restaurants} 
            letterPrefix="R" 
            color={COLORS.secondary} 
          />
          <StatCard 
            title={toLangUpper(t('total_claims'), lang)} 
            value={stats.total_claims} 
            letterPrefix="M" 
            color={COLORS.success} 
          />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* PENDING RESTAURANTS SECTION */}
            <View style={styles.sectionHeaderRow}>
               <Text style={styles.sectionTitle}>{t('admin_pending_rests')}</Text>
               <View style={styles.countBadge}>
                  <Text style={styles.countText}>{pendingRestaurants.length}</Text>
               </View>
            </View>

            {pendingRestaurants.length > 0 ? (
              <FlatList
                data={pendingRestaurants}
                renderItem={renderPendingItem}
                keyExtractor={(item) => `rest-${item.user_id}`}
                scrollEnabled={false}
              />
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                   <Text style={styles.emptyIconText}>✓</Text>
                </View>
                <Text style={styles.emptyText}>{t('admin_no_rests')}</Text>
              </View>
            )}

            {/* PENDING STUDENTS / USERS SECTION */}
            <View style={styles.sectionHeaderRow}>
               <Text style={styles.sectionTitle}>{t('admin_pending_docs')}</Text>
               <View style={styles.countBadge}>
                  <Text style={styles.countText}>{pendingStudents.length}</Text>
               </View>
            </View>

            {pendingStudents.length > 0 ? (
              <FlatList
                data={pendingStudents}
                renderItem={renderPendingItem}
                keyExtractor={(item) => `user-${item.user_id}`}
                scrollEnabled={false}
              />
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                   <Text style={styles.emptyIconText}>✓</Text>
                </View>
                <Text style={styles.emptyText}>{t('admin_no_docs')}</Text>
              </View>
            )}
          </>
        )}
        
        {/* LOGOUT BUTTON */}
        <View style={styles.footer}>
           <Button 
             title={t('logout')} 
             onPress={handleLogout} 
             variant="dangerSoft"
           />
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* --- DOCUMENT VIEWER MODAL --- */}
      <Modal
        visible={docModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDocModalVisible(false)}
      >
        <View style={styles.modalOverlayDark}>
          <View style={styles.docModalContent}>
            <View style={styles.docModalHeader}>
              <Text style={styles.docModalTitle}>{t('document_preview')}</Text>
              <TouchableOpacity onPress={() => setDocModalVisible(false)} hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}>
                <Text style={styles.closeIconText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {selectedDoc ? (
              <Image 
                source={{ uri: selectedDoc }} 
                style={styles.docImage} 
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.emptyText}>{t('image_load_failed')}</Text>
            )}
            
            <Button 
              title={t('close_btn')} 
              onPress={() => setDocModalVisible(false)} 
              style={styles.closeDocBtn} 
            />
          </View>
        </View>
      </Modal>

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
    letterSpacing: 0.5 
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 25,
    marginBottom: 15,
  },
  countBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 10,
  },
  countText: { color: 'white', fontSize: 12, fontWeight: 'bold' },

  // Grid & Stat Cards
  grid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between',
    marginTop: 15
  },
  statCard: { 
    width: '48%', 
    backgroundColor: COLORS.surface, 
    padding: 16, 
    borderRadius: 16, 
    marginBottom: 16,
    borderTopWidth: 4, 
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
  statTitle: { fontSize: 12, color: COLORS.textSub, fontWeight: '700' },

  // Pending Cards
  pendingCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'column',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...SHADOWS.light
  },
  pendingInfo: { flex: 1, marginBottom: 12 },
  pendingHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  userRole: { 
    fontSize: 11, 
    fontWeight: '900', 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 6,
    overflow: 'hidden',
    marginRight: 10
  },
  dateBadge: { fontSize: 11, color: COLORS.textSub, fontWeight: '600' },
  userName: { fontSize: 15, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 2 },
  userEmail: { fontSize: 13, color: COLORS.textSub, marginBottom: 6 },
  userDetail: { fontSize: 12, color: COLORS.secondary, fontStyle: 'italic', fontWeight: '500' },
  
  viewDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: '#F3F4F6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start'
  },
  viewDocText: { fontSize: 11, fontWeight: '800', color: COLORS.textMain },

  // Actions
  actions: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 10 },
  approveBtn: { flex: 1, height: 40, borderRadius: 10 },
  approveBtnText: { fontSize: 12, fontWeight: 'bold' },
  rejectBtn: { flex: 1, height: 40, borderRadius: 10 },
  rejectBtnText: { fontSize: 12, fontWeight: 'bold' },

  // Empty State
  emptyState: { 
    alignItems: 'center', 
    padding: 40, 
    backgroundColor: '#FAFAFA', 
    borderRadius: 16, 
    borderStyle: 'dashed', 
    borderWidth: 1.5, 
    borderColor: '#E0E0E0',
    marginTop: 5,
    marginBottom: 15
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

  // Modals Styles
  modalOverlay: { 
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'flex-end' 
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
  
  // Document Viewer Modal Specific
  modalOverlayDark: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.9)', 
    justifyContent: 'center', alignItems: 'center', padding: 20
  },
  docModalContent: {
    width: '100%', backgroundColor: '#FFFFFF', borderRadius: 24, 
    padding: 24, alignItems: 'center', ...SHADOWS.heavy
  },
  docModalHeader: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  docModalTitle: { fontSize: 18, fontWeight: '900', color: COLORS.textMain },
  closeIconText: { fontSize: 24, fontWeight: '900', color: COLORS.textSub, marginTop: -4 },
  docImage: { width: '100%', height: 400, borderRadius: 16, backgroundColor: '#F3F4F6', marginBottom: 24 },
  closeDocBtn: { width: '100%', height: 50, borderRadius: 12 }
});

export default AdminPanelScreen;