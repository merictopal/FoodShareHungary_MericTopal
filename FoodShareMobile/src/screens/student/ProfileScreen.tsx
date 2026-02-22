import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  RefreshControl, 
  TouchableOpacity, 
  Dimensions, 
  StatusBar, 
  Alert, 
  ActivityIndicator, 
  Modal, 
  ScrollView,
  Platform,
  TouchableWithoutFeedback
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { offersApi } from '../../api/offers';
import { COLORS, SHADOWS } from '../../constants/theme';
import { Header } from '../../components/Header';
import { Button } from '../../components/Button';

// --- CONSTANTS & TYPES ---
const { width } = Dimensions.get('window');

export interface HistoryItem {
  id: number;
  restaurant_name: string;
  offer_title: string;
  type: 'free' | 'discount';
  date: string;
  qr_code: string;
  status: string;
}

export interface UserStats {
  totalOrders: number;
  freeCount: number;
  discountCount: number;
  points: number;
  rank: number; // For Gamification Leaderboard
  nextLevelPoints: number; // For Gamification Progress
}

type TabType = 'all' | 'free' | 'discount';

const ProfileScreen = ({ navigation }: any) => {
  // --- HOOKS & CONTEXT ---
  const { user, logout, t, lang, changeLanguage } = useAuth();
  
  // --- STATE MANAGEMENT ---
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // The selected tab state
  const [activeTab, setActiveTab] = useState<TabType>('all');
  
  // Modals
  const [selectedQr, setSelectedQr] = useState<string | null>(null);
  const [langModalVisible, setLangModalVisible] = useState(false);
  
  // Gamified Stats State
  const [stats, setStats] = useState<UserStats>({ 
    totalOrders: 0, 
    freeCount: 0, 
    discountCount: 0, 
    points: 0,
    rank: 0,
    nextLevelPoints: 100 
  });

  // --- DATA FETCHING & GAMIFICATION LOGIC ---
  const fetchHistory = async () => {
    if (!user?.id) return;
    
    try {
      const res = await offersApi.getHistory(user.id);
      const data: HistoryItem[] = res.data;
      
      // We set the raw history directly. Filtering happens via useMemo.
      setHistory(data);
      
      // Calculate Gamification Statistics dynamically based on history
      const free = data.filter(i => i.type === 'free').length;
      const discount = data.filter(i => i.type === 'discount').length;
      
      // ECO-POINTS SYSTEM: E.g., 20 pts for Free, 10 pts for Discount
      const totalPoints = (free * 20) + (discount * 10);
      
      // Calculate Next Level Target
      const target = Math.ceil((totalPoints + 1) / 100) * 100;

      // Mock Rank calculation
      const estimatedRank = totalPoints > 0 ? Math.max(1, 500 - totalPoints) : 0;

      setStats({
        totalOrders: data.length,
        freeCount: free,
        discountCount: discount,
        points: totalPoints,
        rank: estimatedRank,
        nextLevelPoints: target
      });

    } catch (error) {
      console.error("Error fetching profile history:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    // Intentionally omitting 'activeTab' dependency here to prevent the list
    // from refetching everything and losing the active tab state during a pull-to-refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHistory();
    // No need to reset activeTab to 'all'. The user stays on their current tab.
  }, []);

  // --- FILTERING LOGIC (BUG FIXED) ---
  // The flatlist reads from THIS variable, not the raw history array.
  // When 'history' or 'activeTab' changes, this list recalculates automatically.
  const filteredHistory = useMemo(() => {
    if (activeTab === 'all') return history;
    return history.filter(item => item.type === activeTab);
  }, [history, activeTab]);

  // --- ACTIONS ---
  const handleLogout = () => {
    // Replaced hardcoded Turkish text with dynamic translation
    Alert.alert(
      t('logout'), 
      t('logout_confirm_msg'), 
      [
        { text: t('cancel'), style: "cancel" },
        { text: t('logout'), style: "destructive", onPress: logout }
      ]
    );
  };

  const handleEditProfile = () => {
    Alert.alert(t('nav_profile'), "Profile editing feature is coming soon!");
  };

  const switchLanguage = async (newLang: string) => {
    await changeLanguage(newLang);
    setLangModalVisible(false);
  };

  // --- RENDERERS ---
  const renderHeader = () => {
    const progressPercentage = stats.points > 0 ? (stats.points / stats.nextLevelPoints) * 100 : 0;

    return (
      <View style={styles.headerWrapper}>
        
        {/* 1. PREMIUM PROFILE SECTION */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
             <Text style={styles.avatarText}>
               {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
             </Text>
             
             <TouchableOpacity 
               style={styles.editIconBtn} 
               onPress={handleEditProfile}
               activeOpacity={0.7}
             >
               <Text style={styles.editIconText}>✎</Text>
             </TouchableOpacity>
          </View>

          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            
            <View style={styles.badgeRow}>
               <View style={styles.roleBadge}>
                 <Text style={styles.roleText}>{t('role_student').toUpperCase()}</Text>
               </View>
               <View style={[styles.roleBadge, styles.rankBadge]}>
                 <Text style={styles.rankText}>RANK #{stats.rank || '--'}</Text>
               </View>
            </View>
          </View>
        </View>

        {/* 2. LEVEL PROGRESS BAR */}
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.levelText}>Eco-Warrior Level</Text>
            <Text style={styles.pointsText}>{stats.points} / {stats.nextLevelPoints} PTS</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercentage}%` }]} />
          </View>
        </View>

        {/* 3. GAMIFIED STATS DASHBOARD */}
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>{t('savings_report')}</Text>
          <View style={styles.statsGrid}>
            
            <View style={styles.statItem}>
               <Text style={styles.statValue}>{stats.totalOrders}</Text>
               <Text style={styles.statLabel}>{t('orders')}</Text>
            </View>
            <View style={styles.verticalLine} />
            
            <View style={styles.statItem}>
               <Text style={[styles.statValue, { color: COLORS.primary }]}>{stats.points}</Text>
               <Text style={styles.statLabel}>{t('saved')}</Text>
            </View>
            <View style={styles.verticalLine} />

            <View style={styles.statItem}>
               <Text style={[styles.statValue, { color: COLORS.success }]}>{stats.freeCount}</Text>
               <Text style={styles.statLabel}>{t('free_meals')}</Text>
            </View>

          </View>
        </View>

        {/* 4. QUICK MENU CHIPS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickMenu}>
          {['notifications', 'security', 'help'].map((item) => (
             <TouchableOpacity key={item} style={styles.menuChip} activeOpacity={0.6}>
                <Text style={styles.menuText}>{t(item).toUpperCase()}</Text>
             </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 5. FILTER TABS */}
        <View style={styles.tabsContainer}>
          {(['all', 'free', 'discount'] as TabType[]).map((tab) => (
            <TouchableOpacity 
              key={tab}
              style={[styles.tabBtn, activeTab === tab && styles.tabActive]} 
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {t(tab)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

      </View>
    );
  };

  // --- RENDER ITEM (Order Card) ---
  const renderHistoryItem = ({ item }: { item: HistoryItem }) => {
    const isFree = item.type === 'free';
    const typeLetter = isFree ? 'F' : 'D'; 
    const typeColor = isFree ? COLORS.success : COLORS.warning;
    const typeBgColor = isFree ? '#E8F5E9' : '#FFF3E0'; 
    
    return (
      <TouchableOpacity 
        style={styles.historyCard} 
        onPress={() => setSelectedQr(item.qr_code)}
        activeOpacity={0.7}
      >
        <View style={[styles.cardStrip, { backgroundColor: typeColor }]} />
        
        <View style={[styles.cardIconBox, { backgroundColor: typeBgColor }]}>
           <Text style={[styles.cardIconLetter, { color: typeColor }]}>{typeLetter}</Text>
        </View>

        <View style={styles.cardContent}>
           <Text style={styles.restName} numberOfLines={1}>{item.restaurant_name}</Text>
           <Text style={styles.offerName} numberOfLines={1}>{item.offer_title}</Text>
           <Text style={styles.dateText}>{item.date}</Text>
        </View>

        <View style={styles.cardAction}>
           <View style={styles.qrBadge}>
             <Text style={styles.qrIconText}>QR</Text>
           </View>
           <Text style={styles.qrLabel}>CODE</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      <Header 
        title={t('nav_profile')} 
        onBack={() => navigation.goBack()}
        rightIcon={lang ? lang.toUpperCase() : 'EN'} 
        onRightPress={() => setLangModalVisible(true)} 
      />

      {loading ? (
        <View style={styles.centerBox}>
           <ActivityIndicator size="large" color={COLORS.primary} />
           {/* Fallback to simple text, assuming user understands "Loading" globally */}
           <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredHistory}
          renderItem={renderHistoryItem}
          keyExtractor={(item) => item.id.toString()}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              tintColor={COLORS.primary} 
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconCircle}>
                 <Text style={styles.emptyIconText}>!</Text>
              </View>
              <Text style={styles.emptyTitle}>{t('empty_list')}</Text>
            </View>
          }
        />
      )}

      {/* FOOTER: Logout Button */}
      <View style={styles.footer}>
         <Button 
           title={t('logout')} 
           onPress={handleLogout} 
           variant="secondary"
           style={styles.logoutBtn}
           textStyle={styles.logoutText}
         />
      </View>

      {/* --- QR CODE WALLET MODAL --- */}
      <Modal
        visible={!!selectedQr}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedQr(null)}
      >
        <TouchableWithoutFeedback onPress={() => setSelectedQr(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                   <Text style={styles.modalTitle}>{t('qr_title')}</Text>
                   <TouchableOpacity onPress={() => setSelectedQr(null)} hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}>
                     <Text style={styles.closeIconText}>✕</Text>
                   </TouchableOpacity>
                </View>
                
                <View style={styles.qrContainer}>
                  <View style={styles.qrBorder}>
                     <Text style={styles.qrData}>{selectedQr}</Text>
                  </View>
                </View>
                
                <Text style={styles.modalInfo}>
                  {t('msg_claim_success')}
                </Text>

                <Button title={t('close_btn')} onPress={() => setSelectedQr(null)} style={styles.modalActionBtn} />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* --- LANGUAGE SELECTION MODAL --- */}
      <Modal
        visible={langModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setLangModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setLangModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.langModalCard}>
                
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{t('lang_change')}</Text>
                  <TouchableOpacity onPress={() => setLangModalVisible(false)} hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}>
                     <Text style={styles.closeIconText}>✕</Text>
                   </TouchableOpacity>
                </View>
                
                {[
                  { code: 'en', label: 'English', subLabel: 'EN' },
                  { code: 'tr', label: 'Türkçe', subLabel: 'TR' },
                  { code: 'hu', label: 'Magyar', subLabel: 'HU' }
                ].map((l) => (
                  <TouchableOpacity 
                    key={l.code}
                    style={[styles.langBtn, lang === l.code && styles.langBtnActive]} 
                    onPress={() => switchLanguage(l.code)}
                    activeOpacity={0.7}
                  >
                     <Text style={[styles.langText, lang === l.code && styles.langTextActive]}>
                       {l.label}
                     </Text>
                     <View style={[styles.langBadge, lang === l.code && styles.langBadgeActive]}>
                       <Text style={[styles.langBadgeText, lang === l.code && styles.langBadgeTextActive]}>
                         {l.subLabel}
                       </Text>
                     </View>
                  </TouchableOpacity>
                ))}

              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

    </View>
  );
};

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: COLORS.textSub, fontWeight: '600', letterSpacing: 0.5 },

  headerWrapper: { padding: 24, paddingBottom: 0 },
  
  // Profile Header
  profileSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  avatarContainer: { 
    width: 80, height: 80, borderRadius: 24, 
    backgroundColor: COLORS.primary, 
    justifyContent: 'center', alignItems: 'center', 
    marginRight: 16, borderWidth: 3, borderColor: '#FFFFFF', 
    ...SHADOWS.medium 
  },
  avatarText: { fontSize: 32, color: '#FFFFFF', fontWeight: '900' },
  editIconBtn: { 
    position: 'absolute', bottom: -5, right: -5, 
    backgroundColor: '#FFFFFF', padding: 6, borderRadius: 12, 
    borderWidth: 1, borderColor: '#EEEEEE',
    ...SHADOWS.light
  },
  editIconText: { fontSize: 12, fontWeight: '900', color: COLORS.textMain, marginTop: -2 },
  
  userInfo: { flex: 1 },
  userName: { fontSize: 24, fontWeight: '900', color: COLORS.textMain, marginBottom: 4, letterSpacing: -0.5 },
  userEmail: { fontSize: 13, color: COLORS.textSub, marginBottom: 12, fontWeight: '500' },
  
  badgeRow: { flexDirection: 'row' },
  roleBadge: { backgroundColor: '#F0F0F0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  roleText: { fontSize: 10, color: COLORS.textSub, fontWeight: '800', letterSpacing: 0.5 },
  rankBadge: { backgroundColor: '#FFF0F0', marginLeft: 8 },
  rankText: { fontSize: 10, color: COLORS.primary, fontWeight: '900', letterSpacing: 0.5 },

  // Gamification Progress Bar
  progressContainer: { marginBottom: 24, paddingHorizontal: 4 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  levelText: { fontSize: 12, fontWeight: '800', color: COLORS.textMain, textTransform: 'uppercase', letterSpacing: 0.5 },
  pointsText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  progressBarBg: { height: 8, backgroundColor: '#EEEEEE', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 4 },

  // Stats Card
  statsCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: '#F0F0F0', ...SHADOWS.light },
  statsTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textMain, marginBottom: 20, letterSpacing: 0.5, textTransform: 'uppercase' },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 24, fontWeight: '900', color: COLORS.textMain, letterSpacing: -0.5 },
  statLabel: { fontSize: 10, color: COLORS.textSub, marginTop: 6, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  verticalLine: { width: 1, height: 40, backgroundColor: '#F0F0F0' },

  // Quick Menu Chips
  quickMenu: { marginBottom: 24 },
  menuChip: { 
    backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingVertical: 12, 
    borderRadius: 12, marginRight: 12, borderWidth: 1, borderColor: '#EEEEEE',
    ...SHADOWS.light
  },
  menuText: { fontSize: 11, fontWeight: '800', color: COLORS.textMain, letterSpacing: 0.5 },

  // Filtering Tabs
  tabsContainer: { flexDirection: 'row', backgroundColor: '#F5F5F5', borderRadius: 14, padding: 6, marginBottom: 20 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#FFFFFF', ...SHADOWS.light },
  tabText: { fontSize: 12, color: COLORS.textSub, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  tabTextActive: { color: COLORS.primary, fontWeight: '900' },

  // History List Cards
  historyCard: { 
    flexDirection: 'row', backgroundColor: '#FFFFFF', marginBottom: 16, 
    borderRadius: 20, overflow: 'hidden', height: 86, alignItems: 'center', 
    marginHorizontal: 24, borderWidth: 1, borderColor: '#F5F5F5', ...SHADOWS.light 
  },
  cardStrip: { width: 6, height: '100%' },
  cardIconBox: { 
    width: 48, height: 48, borderRadius: 14, 
    justifyContent: 'center', alignItems: 'center', 
    marginLeft: 16, marginRight: 16 
  },
  cardIconLetter: { fontSize: 20, fontWeight: '900' },
  cardContent: { flex: 1, paddingVertical: 10, justifyContent: 'center' },
  restName: { fontSize: 15, fontWeight: '800', color: COLORS.textMain, marginBottom: 4, letterSpacing: -0.3 },
  offerName: { fontSize: 13, color: COLORS.textSub, marginBottom: 6, fontWeight: '500' },
  dateText: { fontSize: 10, color: '#A0A0A0', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  
  cardAction: { 
    width: 76, alignItems: 'center', borderLeftWidth: 1, 
    borderLeftColor: '#F5F5F5', height: '60%', justifyContent: 'center' 
  },
  qrBadge: { backgroundColor: '#F8F9FA', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginBottom: 4 },
  qrIconText: { fontSize: 12, fontWeight: '900', color: COLORS.textMain },
  qrLabel: { fontSize: 9, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.5 },

  // Empty State
  emptyBox: { alignItems: 'center', marginTop: 40, paddingHorizontal: 40 },
  emptyIconCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#F5F5F5',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16
  },
  emptyIconText: { fontSize: 28, fontWeight: '900', color: '#CCCCCC' },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textSub, textAlign: 'center', lineHeight: 22 },

  // Footer & Buttons
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, backgroundColor: 'rgba(255,255,255,0.95)', borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  logoutBtn: { backgroundColor: '#FFF0F0', borderWidth: 1, borderColor: '#FFE5E5', borderRadius: 16, height: 56 },
  logoutText: { color: COLORS.danger, fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },

  // Modals Overlay Structure
  modalOverlay: { 
    flex: 1, backgroundColor: 'rgba(31, 41, 51, 0.4)', 
    justifyContent: 'flex-end', alignItems: 'center' 
  },
  
  // QR Modal Specific
  modalCard: { 
    width: '100%', backgroundColor: '#FFFFFF', 
    borderTopLeftRadius: 32, borderTopRightRadius: 32, 
    padding: 32, alignItems: 'center', ...SHADOWS.heavy 
  },
  modalHeader: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '900', color: COLORS.textMain, letterSpacing: -0.5 },
  closeIconText: { fontSize: 20, color: '#A0A0A0', fontWeight: '900' },
  
  qrContainer: { padding: 24, backgroundColor: '#F8F9FA', borderRadius: 24, marginBottom: 24, width: '100%', alignItems: 'center' },
  qrBorder: { 
    width: 220, height: 220, borderWidth: 2, borderColor: COLORS.primary, 
    borderStyle: 'dashed', borderRadius: 20, justifyContent: 'center', 
    alignItems: 'center', backgroundColor: '#FFFFFF' 
  },
  qrData: { fontSize: 24, fontWeight: '900', letterSpacing: 2, color: COLORS.textMain },
  modalInfo: { textAlign: 'center', color: COLORS.textSub, fontSize: 14, lineHeight: 22, fontWeight: '500', marginBottom: 24 },
  modalActionBtn: { width: '100%', height: 56, borderRadius: 16 },

  // Language Modal Specific
  langModalCard: { 
    backgroundColor: '#FFFFFF', width: '100%',
    borderTopLeftRadius: 32, borderTopRightRadius: 32, 
    padding: 32, alignItems: 'center', 
    ...SHADOWS.heavy 
  },
  langBtn: {
    width: '100%', padding: 20, borderRadius: 16,
    backgroundColor: '#FFFFFF', marginBottom: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E7EB'
  },
  langBtnActive: { backgroundColor: '#F5FBFF', borderColor: COLORS.primary },
  langText: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },
  langTextActive: { color: COLORS.primary, fontWeight: '900' },
  langBadge: { backgroundColor: '#F5F5F5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  langBadgeActive: { backgroundColor: COLORS.primary },
  langBadgeText: { fontSize: 12, fontWeight: '800', color: COLORS.textSub },
  langBadgeTextActive: { color: '#FFFFFF' }
});

export default ProfileScreen;