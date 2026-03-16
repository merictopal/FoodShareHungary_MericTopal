import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  RefreshControl, 
  TouchableOpacity, 
  Dimensions, 
  StatusBar, 
  Alert, 
  ActivityIndicator, 
  Modal, 
  ScrollView,
  Platform,
  TouchableWithoutFeedback,
  Image 
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { offersApi } from '../../api/offers';
import { client } from '../../api/client'; 
import { COLORS, SHADOWS } from '../../constants/theme';
import { Header } from '../../components/Header';
import { Button } from '../../components/Button';
import QRCode from 'react-native-qrcode-svg';
import { launchCamera, launchImageLibrary, Asset } from 'react-native-image-picker';

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
  level: number; 
  rank: number; 
  nextLevelPoints: number; 
}

type TabType = 'all' | 'free' | 'discount';

// --- EXTRACTED HISTORY CARD COMPONENT (WITH DYNAMIC TRANSLATION) ---
const HistoryCard = ({ item, onPress, t }: { item: HistoryItem, onPress: () => void, t: any }) => {
  const isFree = item.type === 'free';
  const isPending = item.status === 'pending';
  const isValidated = item.status === 'validated';

  // Dynamic colors and text based on type
  const typeColor = isFree ? '#2ECC71' : '#F39C12'; 
  const typeLabel = isFree ? t('free').toUpperCase() : t('discount').toUpperCase();

  // Dynamic colors and text based on status
  const cardBg = isPending ? '#FFF8E1' : (isValidated ? '#E8F5E9' : '#F5F5F5');
  const statusColor = isPending ? '#F5B041' : (isValidated ? '#2ECC71' : '#95A5A6');
  const badgeIcon = isPending ? '🕒' : (isValidated ? '✓' : '✖');
  
  // Use translations for status badges
  let badgeText = t('status_cancelled');
  if (isPending) {
    badgeText = t('status_pending');
  }
  if (isValidated) {
    badgeText = t('status_validated');
  }

  return (
    <TouchableOpacity 
      style={[styles.historyCard, { backgroundColor: cardBg }]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.cardStrip, { backgroundColor: typeColor }]} />
      
      <View style={[styles.cardIconBox, { backgroundColor: '#FFFFFF' }]}>
         <Text style={[styles.cardIconLetter, { color: typeColor }]}>
           {isFree ? 'F' : 'D'}
         </Text>
      </View>

      <View style={styles.cardContent}>
         <Text style={styles.restName} numberOfLines={1}>
           {item.restaurant_name}
         </Text>
         <Text style={styles.offerName} numberOfLines={1}>
           {item.offer_title}
         </Text>
         
         <View style={styles.typeLabelRow}>
           <View style={[styles.typeIndicatorDot, { backgroundColor: typeColor }]} />
           <Text style={[styles.typeLabelText, { color: typeColor }]}>
             {typeLabel}
           </Text>
           <Text style={styles.dateLabelText}>
             • {item.date}
           </Text>
         </View>
      </View>

      <View style={styles.cardAction}>
         <View style={[styles.statusCircle, { backgroundColor: statusColor }]}>
           <Text style={styles.statusCircleIcon}>
             {badgeIcon}
           </Text>
         </View>
         <Text style={[styles.statusLabelText, { color: statusColor }]}>
           {badgeText}
         </Text>
      </View>
    </TouchableOpacity>
  );
};

const ProfileScreen = ({ navigation }: any) => {
  // --- HOOKS & CONTEXT ---
  const { user, logout, t, lang, changeLanguage, updateUser } = useAuth();  
  
  // --- STATE MANAGEMENT ---
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [activeTab, setActiveTab] = useState<TabType>('all');
  
  // Modals
  const [selectedQr, setSelectedQr] = useState<string | null>(null);
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  
  // Document Verification
  const [verificationModalVisible, setVerificationModalVisible] = useState(false);
  const [docType, setDocType] = useState<'student' | 'pensioner' | 'social'>('student');
  const [docImage, setDocImage] = useState<Asset | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  
  // Gamified Stats
  const [stats, setStats] = useState<UserStats>({ 
    totalOrders: 0, 
    freeCount: 0, 
    discountCount: 0, 
    points: 0,
    level: 1,
    rank: 0,
    nextLevelPoints: 100 
  });

  // Mock Notifications Data
  const mockNotifications = [
    { 
      id: 1, 
      title: 'Welcome to FoodShare! 🎉', 
      body: 'Start exploring offers around you.', 
      time: 'Just now', 
      unread: true 
    },
    { 
      id: 2, 
      title: 'New Level Unlocked', 
      body: 'You reached a new Level!', 
      time: '2 hours ago', 
      unread: false 
    }
  ];

  // Helper for dynamic gamification title translation
  const getLevelTitle = (level: number) => {
    if (level >= 10) return t('lvl_legend');
    if (level >= 8) return t('lvl_local_hero');
    if (level >= 5) return t('lvl_eco_warrior');
    if (level >= 3) return t('lvl_food_saver');
    return t('lvl_newbie');
  };

  // --- DATA FETCHING & GAMIFICATION LOGIC ---
  const fetchHistory = async () => {
    if (!user?.id) return;
    
    try {
      const res = await offersApi.getHistory(user.id);
      const data: HistoryItem[] = Array.isArray(res.data) ? res.data : (res.data.history || []);
      
      setHistory(data);
      
      const validatedHistory = data.filter(i => i.status === 'validated');
      const free = validatedHistory.filter(i => i.type === 'free').length;
      const discount = validatedHistory.filter(i => i.type === 'discount').length;
      
      const liveXp = res.data.xp !== undefined ? res.data.xp : ((user as any)?.xp || 0);
      const liveLevel = res.data.level !== undefined ? res.data.level : ((user as any)?.level || 1);
      
      const target = liveLevel * 100;
      const estimatedRank = liveXp > 0 ? Math.max(1, 500 - Math.floor(liveXp / 10)) : 0;

      setStats({
        totalOrders: validatedHistory.length,
        freeCount: free,
        discountCount: discount,
        points: liveXp,
        level: liveLevel,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHistory();
  }, []);

  const filteredHistory = useMemo(() => {
    if (activeTab === 'all') return history;
    return history.filter(item => item.type === activeTab);
  }, [history, activeTab]);

  // --- ACTIONS ---
  const handleLogout = () => {
    Alert.alert(
      t('logout'), 
      t('logout_confirm_msg'), 
      [
        { 
          text: t('cancel'), 
          style: "cancel" 
        },
        { 
          text: t('logout'), 
          style: "destructive", 
          onPress: logout 
        }
      ]
    );
  };

  const handleEditProfile = () => {
    Alert.alert(
      t('nav_profile'), 
      "Profile editing feature is coming soon!"
    );
  };

  const switchLanguage = async (newLang: string) => {
    await changeLanguage(newLang);
    setLangModalVisible(false);
  };

  const handleQuickMenuPress = (item: string) => {
    if (item === 'notifications') {
      setNotifModalVisible(true);
    } else if (item === 'security') {
      if (user?.verification_status === 'verified') {
        Alert.alert(
          t('verified') || 'Verified', 
          'Your account is already securely verified! ✅'
        );
      } else {
        setVerificationModalVisible(true);
      }
    } else {
      Alert.alert(
        t(item).toUpperCase(), 
        "This feature will be available soon!"
      );
    }
  };

  const handleSelectDocImage = () => {
    Alert.alert(
      t('choose_photo_method') || "Upload Document",
      "",
      [
        {
          text: t('camera') || "Camera",
          onPress: () => {
            launchCamera({ mediaType: 'photo', quality: 0.8 }, (response) => {
              if (response.assets && response.assets.length > 0) {
                setDocImage(response.assets[0]);
              }
            });
          }
        },
        {
          text: t('gallery') || "Gallery",
          onPress: () => {
            launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, (response) => {
              if (response.assets && response.assets.length > 0) {
                setDocImage(response.assets[0]);
              }
            });
          }
        },
        { 
          text: t('cancel') || "Cancel", 
          style: "cancel" 
        }
      ]
    );
  };

  const handleUploadDocument = async () => {
    if (!docImage) {
      Alert.alert(
        t('error') || "Error", 
        "Please select or capture a document photo first."
      );
      return;
    }

    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append('user_id', String(user?.id));
      formData.append('document_type', docType);
      formData.append('file', {
        uri: docImage.uri,
        type: docImage.type || 'image/jpeg',
        name: docImage.fileName || `doc-user-${user?.id}.jpg`,
      } as any);

      await client.post('/upload/user-document', formData, { 
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (user) {
        updateUser({ ...user, verification_status: 'pending' });
      }

      Alert.alert(
        t('success') || "Success!", 
        t('msg_verify_sent') || "Your document has been sent."
      );
      setVerificationModalVisible(false);
      setDocImage(null); 
      
    } catch (error: any) {
      Alert.alert(
        t('error') || "Error", 
        "Failed to upload document."
      );
    } finally {
      setUploadingDoc(false);
    }
  };

  // --- RENDERERS ---
  const renderHeader = () => {
    const progressPercentage = stats.points > 0 ? Math.min((stats.points / stats.nextLevelPoints) * 100, 100) : 0;
    
    const isVerified = user?.verification_status === 'verified';
    const isPending = user?.verification_status === 'pending';

    return (
      <View style={styles.headerWrapper}>
        
        {/* PREMIUM PROFILE SECTION */}
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
            <Text style={styles.userName}>
              {user?.name}
            </Text>
            <Text style={styles.userEmail}>
              {user?.email}
            </Text>
            
            <View style={styles.badgeRow}>
               <View style={[styles.roleBadge, isVerified ? styles.badgeVerified : (isPending ? styles.badgePending : styles.badgeUnverified)]}>
                 <Text style={[styles.roleText, isVerified ? styles.textVerified : (isPending ? styles.textPending : styles.textUnverified)]}>
                    {isVerified ? t('verified') : (isPending ? t('pending') : t('unverified'))}
                 </Text>
               </View>
               <View style={[styles.roleBadge, styles.rankBadge]}>
                 <Text style={styles.rankText}>
                   RANK #{stats.rank || '--'}
                 </Text>
               </View>
            </View>
          </View>
        </View>

        {/* PENDING VERIFICATION BANNER */}
        {isPending && (
          <View style={[styles.verificationBanner, { backgroundColor: '#FFFBEB', borderColor: '#FEF08A' }]}>
            <View style={[styles.bannerIconBox, { backgroundColor: '#FEF08A' }]}>
              <Text style={[styles.bannerIconText, { color: '#D97706' }]}>⏳</Text>
            </View>
            <View style={styles.bannerTextContent}>
              <Text style={[styles.bannerTitle, { color: '#D97706' }]}>
                {t('pending')}
              </Text>
              <Text style={[styles.bannerSub, { color: '#B45309' }]}>
                {t('msg_verify_sent')}
              </Text>
            </View>
          </View>
        )}

        {/* UNVERIFIED BANNER */}
        {!isVerified && !isPending && (
          <TouchableOpacity 
            style={styles.verificationBanner} 
            activeOpacity={0.8} 
            onPress={() => setVerificationModalVisible(true)}
          >
            <View style={styles.bannerIconBox}>
              <Text style={styles.bannerIconText}>!</Text>
            </View>
            <View style={styles.bannerTextContent}>
              <Text style={styles.bannerTitle}>
                {t('unverified')}
              </Text>
              <Text style={styles.bannerSub}>
                {t('verify_action')}
              </Text>
            </View>
            <Text style={styles.bannerArrow}>➤</Text>
          </TouchableOpacity>
        )}

        {/* REAL GAMIFICATION LEVEL PROGRESS BAR */}
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.levelText}>
              LEVEL {stats.level} • {getLevelTitle(stats.level)}
            </Text>
            <Text style={styles.pointsText}>
              {stats.points} / {stats.nextLevelPoints} XP
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercentage}%` }]} />
          </View>
        </View>

        {/* GAMIFIED STATS DASHBOARD */}
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>
            {t('savings_report')}
          </Text>
          <View style={styles.statsGrid}>
            
            <View style={styles.statItem}>
               <Text style={styles.statValue}>
                 {stats.totalOrders}
               </Text>
               <Text style={styles.statLabel}>
                 {t('orders')}
               </Text>
            </View>
            <View style={styles.verticalLine} />
            
            <View style={styles.statItem}>
               <Text style={[styles.statValue, { color: COLORS.primary }]}>
                 {stats.points}
               </Text>
               <Text style={styles.statLabel}>
                 TOTAL XP
               </Text>
            </View>
            <View style={styles.verticalLine} />

            <View style={styles.statItem}>
               <Text style={[styles.statValue, { color: COLORS.success }]}>
                 {stats.freeCount}
               </Text>
               <Text style={styles.statLabel}>
                 {t('free_meals')}
               </Text>
            </View>
          </View>
        </View>

        {/* DYNAMIC FREE VS DISCOUNTED BANNER */}
        <View style={styles.detailedStatsWrapper}>
          <View style={styles.detailedStatsContainer}>
            <View style={[styles.detailedStatHalf, { backgroundColor: '#2ECC71' }]}>
              <Text style={styles.detailedStatTitle}>
                {t('free_meals').toUpperCase()}
              </Text>
              <Text style={styles.detailedStatValue}>
                {stats.freeCount}
              </Text>
            </View>
            <View style={[styles.detailedStatHalf, { backgroundColor: '#F39C12' }]}>
              <Text style={styles.detailedStatTitle}>
                {t('discount_meals').toUpperCase()}
              </Text>
              <Text style={styles.detailedStatValue}>
                {stats.discountCount}
              </Text>
            </View>
          </View>
          <View style={styles.totalBadgeContainer}>
            <Text style={styles.totalBadgeText}>
              {t('total_offers')}: {stats.freeCount + stats.discountCount}
            </Text>
          </View>
        </View>

        {/* QUICK MENU CHIPS */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.quickMenu}
        >
          {['notifications', 'security', 'help'].map((item) => (
             <TouchableOpacity 
               key={item} 
               style={styles.menuChip} 
               activeOpacity={0.6} 
               onPress={() => handleQuickMenuPress(item)}
             >
                <Text style={styles.menuText}>
                  {t(item).toUpperCase()}
                </Text>
             </TouchableOpacity>
          ))}
        </ScrollView>

        {/* FILTER TABS */}
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

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor={COLORS.background} 
      />
      
      <Header 
        title={t('nav_profile')} 
        onBack={() => navigation.goBack()}
        rightIcon={lang ? lang.toUpperCase() : 'EN'} 
        onRightPress={() => setLangModalVisible(true)} 
      />

      {loading ? (
        <View style={styles.centerBox}>
           <ActivityIndicator size="large" color={COLORS.primary} />
           <Text style={styles.loadingText}>
             Loading...
           </Text>
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              tintColor={COLORS.primary} 
            />
          }
        >
          {renderHeader()}

          {/* EMPTY STATE */}
          {filteredHistory.length === 0 && (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconCircle}>
                 <Text style={styles.emptyIconText}>!</Text>
              </View>
              <Text style={styles.emptyTitle}>
                {t('empty_list')}
              </Text>
            </View>
          )}

          {/* PENDING OFFERS SECTION */}
          {filteredHistory.filter(i => i.status === 'pending').length > 0 && (
            <View style={styles.listSection}>
              <Text style={[styles.sectionHeaderTitle, { color: '#F39C12' }]}>
                {t('pending_offers')} ({filteredHistory.filter(i => i.status === 'pending').length})
              </Text>
              {filteredHistory.filter(i => i.status === 'pending').map((item) => (
                <HistoryCard 
                  key={item.id} 
                  item={item} 
                  onPress={() => setSelectedQr(item.qr_code)} 
                  t={t} 
                />
              ))}
            </View>
          )}

          {/* VALIDATED OFFERS SECTION */}
          {filteredHistory.filter(i => i.status === 'validated').length > 0 && (
            <View style={styles.listSection}>
              <Text style={[styles.sectionHeaderTitle, { color: '#2ECC71' }]}>
                {t('validated_offers')} ({filteredHistory.filter(i => i.status === 'validated').length})
              </Text>
              {filteredHistory.filter(i => i.status === 'validated').map((item) => (
                <HistoryCard 
                  key={item.id} 
                  item={item} 
                  onPress={() => setSelectedQr(item.qr_code)} 
                  t={t} 
                />
              ))}
            </View>
          )}
        </ScrollView>
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

      {/* --- DOCUMENT VERIFICATION MODAL --- */}
      <Modal 
        visible={verificationModalVisible} 
        transparent={true} 
        animationType="slide" 
        onRequestClose={() => setVerificationModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setVerificationModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.verificationModalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {t('verify_action')}
                  </Text>
                  <TouchableOpacity 
                    onPress={() => setVerificationModalVisible(false)} 
                    hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
                  >
                     <Text style={styles.closeIconText}>✕</Text>
                   </TouchableOpacity>
                </View>
                
                <View style={styles.docTypeContainer}>
                  {[ 
                    { id: 'student', label: 'Student ID' }, 
                    { id: 'pensioner', label: '65+ Age' }, 
                    { id: 'social', label: 'Social Relief' }
                  ].map((type) => (
                    <TouchableOpacity 
                      key={type.id} 
                      style={[styles.docTypeBtn, docType === type.id && styles.docTypeBtnActive]} 
                      onPress={() => setDocType(type.id as any)} 
                      activeOpacity={0.7}
                    >
                      <View style={[styles.docRadioBtn, docType === type.id && styles.docRadioBtnActive]}>
                        {docType === type.id && <View style={styles.docRadioInner} />}
                      </View>
                      <Text style={[styles.docTypeText, docType === type.id && styles.docTypeTextActive]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.docImageContainer}>
                  {docImage?.uri ? (
                    <View style={styles.docPreviewWrapper}>
                      <Image 
                        source={{ uri: docImage.uri }} 
                        style={styles.docPreviewImage} 
                      />
                      <TouchableOpacity 
                        onPress={handleSelectDocImage} 
                        style={styles.docChangeBtn}
                      >
                        <Text style={styles.docChangeText}>
                          {t('change_photo')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity 
                      onPress={handleSelectDocImage} 
                      style={styles.docUploadBtn}
                    >
                      <Text style={styles.docUploadIcon}>📸</Text>
                      <Text style={styles.docUploadText}>
                        {t('add_photo')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Button 
                  title={t('save')} 
                  onPress={handleUploadDocument} 
                  loading={uploadingDoc} 
                  style={{ width: '100%', marginTop: 10 }} 
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

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
                   <Text style={styles.modalTitle}>
                     {t('qr_title')}
                   </Text>
                   <TouchableOpacity 
                     onPress={() => setSelectedQr(null)} 
                     hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
                   >
                     <Text style={styles.closeIconText}>✕</Text>
                   </TouchableOpacity>
                </View>
                <View style={styles.qrContainer}>
                  {selectedQr && (
                    <QRCode 
                      value={selectedQr} 
                      size={200} 
                      color="black" 
                      backgroundColor="transparent" 
                    />
                  )}
                </View>
                <Text style={styles.modalInfo}>
                  {t('msg_claim_success')}
                </Text>
                <Button 
                  title={t('close_btn')} 
                  onPress={() => setSelectedQr(null)} 
                  style={styles.modalActionBtn} 
                />
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
                  <Text style={styles.modalTitle}>
                    {t('lang_change')}
                  </Text>
                  <TouchableOpacity 
                    onPress={() => setLangModalVisible(false)} 
                    hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
                  >
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

      {/* --- NOTIFICATIONS MODAL --- */}
      <Modal 
        visible={notifModalVisible} 
        transparent={true} 
        animationType="slide" 
        onRequestClose={() => setNotifModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setNotifModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.notifModalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {t('notifications').toUpperCase()}
                  </Text>
                  <TouchableOpacity 
                    onPress={() => setNotifModalVisible(false)} 
                    hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
                  >
                     <Text style={styles.closeIconText}>✕</Text>
                   </TouchableOpacity>
                </View>
                <ScrollView 
                  showsVerticalScrollIndicator={false} 
                  style={styles.notifScrollView}
                >
                  {mockNotifications.map((notif) => (
                    <View key={notif.id} style={styles.notifCard}>
                      <View style={styles.notifTextContainer}>
                        <Text style={styles.notifTitle}>
                          {notif.title}
                        </Text>
                        <Text style={styles.notifBody}>
                          {notif.body}
                        </Text>
                        <Text style={styles.notifTime}>
                          {notif.time}
                        </Text>
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

    </View>
  );
};

// --- STYLES ---
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background 
  },
  centerBox: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingText: { 
    marginTop: 12, 
    color: COLORS.textSub, 
    fontWeight: '600', 
    letterSpacing: 0.5 
  },
  headerWrapper: { 
    padding: 24, 
    paddingBottom: 0 
  },
  
  // Profile Header Elements
  profileSection: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 24 
  },
  avatarContainer: { 
    width: 80, 
    height: 80, 
    borderRadius: 24, 
    backgroundColor: COLORS.primary, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 16, 
    borderWidth: 3, 
    borderColor: '#FFFFFF', 
    ...SHADOWS.medium 
  },
  avatarText: { 
    fontSize: 32, 
    color: '#FFFFFF', 
    fontWeight: '900' 
  },
  editIconBtn: { 
    position: 'absolute', 
    bottom: -5, 
    right: -5, 
    backgroundColor: '#FFFFFF', 
    padding: 6, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#EEEEEE', 
    ...SHADOWS.light 
  },
  editIconText: { 
    fontSize: 12, 
    fontWeight: '900', 
    color: COLORS.textMain, 
    marginTop: -2 
  },
  userInfo: { 
    flex: 1 
  },
  userName: { 
    fontSize: 24, 
    fontWeight: '900', 
    color: COLORS.textMain, 
    marginBottom: 4, 
    letterSpacing: -0.5 
  },
  userEmail: { 
    fontSize: 13, 
    color: COLORS.textSub, 
    marginBottom: 12, 
    fontWeight: '500' 
  },
  
  // Badges
  badgeRow: { 
    flexDirection: 'row' 
  },
  roleBadge: { 
    backgroundColor: '#F0F0F0', 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 8 
  },
  roleText: { 
    fontSize: 10, 
    color: COLORS.textSub, 
    fontWeight: '800', 
    letterSpacing: 0.5 
  },
  rankBadge: { 
    backgroundColor: '#FFF0F0', 
    marginLeft: 8 
  },
  rankText: { 
    fontSize: 10, 
    color: COLORS.primary, 
    fontWeight: '900', 
    letterSpacing: 0.5 
  },
  badgeVerified: { 
    backgroundColor: '#E8F5E9' 
  }, 
  textVerified: { 
    color: COLORS.success 
  },
  badgePending: { 
    backgroundColor: '#FFF8E1' 
  }, 
  textPending: { 
    color: '#F59E0B' 
  },
  badgeUnverified: { 
    backgroundColor: '#FEE2E2' 
  }, 
  textUnverified: { 
    color: COLORS.danger 
  },
  
  // Verification Banner
  verificationBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FEF2F2', 
    padding: 16, 
    borderRadius: 16, 
    marginBottom: 24, 
    borderWidth: 1, 
    borderColor: '#FEE2E2', 
    ...SHADOWS.light 
  },
  bannerIconBox: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    backgroundColor: '#FECACA', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12 
  },
  bannerIconText: { 
    fontSize: 18, 
    fontWeight: '900', 
    color: COLORS.danger 
  },
  bannerTextContent: { 
    flex: 1 
  },
  bannerTitle: { 
    fontSize: 13, 
    fontWeight: '800', 
    color: COLORS.danger, 
    marginBottom: 2 
  },
  bannerSub: { 
    fontSize: 11, 
    color: '#991B1B', 
    fontWeight: '500' 
  },
  bannerArrow: { 
    fontSize: 16, 
    color: COLORS.danger, 
    fontWeight: '900', 
    marginLeft: 8 
  },
  
  // Progress Bar
  progressContainer: { 
    marginBottom: 24, 
    paddingHorizontal: 4 
  },
  progressHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 8 
  },
  levelText: { 
    fontSize: 12, 
    fontWeight: '800', 
    color: COLORS.textMain, 
    textTransform: 'uppercase', 
    letterSpacing: 0.5 
  },
  pointsText: { 
    fontSize: 12, 
    fontWeight: '800', 
    color: COLORS.primary 
  },
  progressBarBg: { 
    height: 8, 
    backgroundColor: '#EEEEEE', 
    borderRadius: 4, 
    overflow: 'hidden' 
  },
  progressBarFill: { 
    height: '100%', 
    backgroundColor: COLORS.primary, 
    borderRadius: 4 
  },
  
  // Main Stats Card
  statsCard: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 24, 
    padding: 24, 
    marginBottom: 24, 
    borderWidth: 1, 
    borderColor: '#F0F0F0', 
    ...SHADOWS.light 
  },
  statsTitle: { 
    fontSize: 14, 
    fontWeight: '800', 
    color: COLORS.textMain, 
    marginBottom: 20, 
    letterSpacing: 0.5, 
    textTransform: 'uppercase' 
  },
  statsGrid: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  statItem: { 
    alignItems: 'center', 
    flex: 1 
  },
  statValue: { 
    fontSize: 24, 
    fontWeight: '900', 
    color: COLORS.textMain, 
    letterSpacing: -0.5 
  },
  statLabel: { 
    fontSize: 10, 
    color: COLORS.textSub, 
    marginTop: 6, 
    fontWeight: '700', 
    textTransform: 'uppercase', 
    letterSpacing: 0.5 
  },
  verticalLine: { 
    width: 1, 
    height: 40, 
    backgroundColor: '#F0F0F0' 
  },
  
  // Detailed Stats Banner
  detailedStatsWrapper: { 
    marginHorizontal: 0, 
    marginBottom: 24, 
    alignItems: 'center' 
  },
  detailedStatsContainer: { 
    flexDirection: 'row', 
    width: '100%', 
    height: 80, 
    borderRadius: 16, 
    overflow: 'hidden' 
  },
  detailedStatHalf: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  detailedStatTitle: { 
    color: '#FFFFFF', 
    fontSize: 11, 
    fontWeight: '800', 
    letterSpacing: 0.5 
  },
  detailedStatValue: { 
    color: '#FFFFFF', 
    fontSize: 24, 
    fontWeight: '900', 
    marginTop: 4 
  },
  totalBadgeContainer: { 
    position: 'absolute', 
    bottom: -10, 
    backgroundColor: '#FFFFFF', 
    paddingHorizontal: 16, 
    paddingVertical: 4, 
    borderRadius: 12, 
    ...SHADOWS.light 
  },
  totalBadgeText: { 
    fontSize: 10, 
    fontWeight: '800', 
    color: COLORS.textMain 
  },
  
  // Quick Menu
  quickMenu: { 
    marginBottom: 24 
  },
  menuChip: { 
    backgroundColor: '#FFFFFF', 
    paddingHorizontal: 20, 
    paddingVertical: 12, 
    borderRadius: 12, 
    marginRight: 12, 
    borderWidth: 1, 
    borderColor: '#EEEEEE', 
    ...SHADOWS.light 
  },
  menuText: { 
    fontSize: 11, 
    fontWeight: '800', 
    color: COLORS.textMain, 
    letterSpacing: 0.5 
  },
  
  // Filter Tabs
  tabsContainer: { 
    flexDirection: 'row', 
    backgroundColor: '#F5F5F5', 
    borderRadius: 14, 
    padding: 6, 
    marginBottom: 20 
  },
  tabBtn: { 
    flex: 1, 
    paddingVertical: 12, 
    alignItems: 'center', 
    borderRadius: 10 
  },
  tabActive: { 
    backgroundColor: '#FFFFFF', 
    ...SHADOWS.light 
  },
  tabText: { 
    fontSize: 12, 
    color: COLORS.textSub, 
    fontWeight: '800', 
    textTransform: 'uppercase', 
    letterSpacing: 0.5 
  },
  tabTextActive: { 
    color: COLORS.primary, 
    fontWeight: '900' 
  },
  
  // List Sections
  listSection: { 
    marginBottom: 24 
  },
  sectionHeaderTitle: { 
    fontSize: 18, 
    fontWeight: '900', 
    marginLeft: 24, 
    marginBottom: 12, 
    letterSpacing: -0.5 
  },
  
  // History Cards
  historyCard: { 
    flexDirection: 'row', 
    backgroundColor: '#FFFFFF', 
    marginBottom: 16, 
    borderRadius: 20, 
    overflow: 'hidden', 
    height: 86, 
    alignItems: 'center', 
    marginHorizontal: 24, 
    borderWidth: 1, 
    borderColor: '#F5F5F5', 
    ...SHADOWS.light 
  },
  cardStrip: { 
    width: 6, 
    height: '100%' 
  },
  cardIconBox: { 
    width: 48, 
    height: 48, 
    borderRadius: 14, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginLeft: 16, 
    marginRight: 16 
  },
  cardIconLetter: { 
    fontSize: 20, 
    fontWeight: '900' 
  },
  cardContent: { 
    flex: 1, 
    paddingVertical: 10, 
    justifyContent: 'center' 
  },
  restName: { 
    fontSize: 15, 
    fontWeight: '800', 
    color: COLORS.textMain, 
    marginBottom: 4, 
    letterSpacing: -0.3 
  },
  offerName: { 
    fontSize: 13, 
    color: COLORS.textSub, 
    marginBottom: 6, 
    fontWeight: '500' 
  },
  typeLabelRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 6 
  },
  typeIndicatorDot: { 
    width: 6, 
    height: 6, 
    borderRadius: 3, 
    marginRight: 6 
  },
  typeLabelText: { 
    fontSize: 11, 
    fontWeight: '900', 
    letterSpacing: 0.5 
  },
  dateLabelText: { 
    fontSize: 11, 
    fontWeight: '700', 
    color: COLORS.textMain, 
    marginLeft: 4 
  },
  dateTextLarge: { 
    fontSize: 14, 
    color: COLORS.textMain, 
    fontWeight: '900', 
    marginTop: 6, 
    letterSpacing: -0.3 
  },
  cardAction: { 
    width: 76, 
    alignItems: 'center', 
    borderLeftWidth: 1, 
    borderLeftColor: '#F5F5F5', 
    height: '60%', 
    justifyContent: 'center' 
  },
  statusCircle: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 4 
  },
  statusCircleIcon: { 
    color: '#FFFFFF', 
    fontSize: 18, 
    fontWeight: '900' 
  },
  statusLabelText: { 
    fontSize: 9, 
    fontWeight: '900', 
    letterSpacing: 0.5 
  },
  
  // Empty State
  emptyBox: { 
    alignItems: 'center', 
    marginTop: 40, 
    paddingHorizontal: 40 
  },
  emptyIconCircle: { 
    width: 64, 
    height: 64, 
    borderRadius: 32, 
    backgroundColor: '#F5F5F5', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  emptyIconText: { 
    fontSize: 28, 
    fontWeight: '900', 
    color: '#CCCCCC' 
  },
  emptyTitle: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: COLORS.textSub, 
    textAlign: 'center', 
    lineHeight: 22 
  },
  
  // Footer
  footer: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    padding: 24, 
    backgroundColor: 'rgba(255,255,255,0.95)', 
    borderTopWidth: 1, 
    borderTopColor: '#F0F0F0' 
  },
  logoutBtn: { 
    backgroundColor: '#FFF0F0', 
    borderWidth: 1, 
    borderColor: '#FFE5E5', 
    borderRadius: 16, 
    height: 56 
  },
  logoutText: { 
    color: COLORS.danger, 
    fontWeight: '800', 
    fontSize: 15, 
    letterSpacing: 0.5 
  },
  
  // Modals
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(31, 41, 51, 0.4)', 
    justifyContent: 'flex-end', 
    alignItems: 'center' 
  },
  verificationModalCard: { 
    width: '100%', 
    backgroundColor: '#FFFFFF', 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    padding: 32, 
    alignItems: 'center', 
    ...SHADOWS.heavy 
  },
  docModalSub: { 
    fontSize: 13, 
    color: COLORS.textSub, 
    textAlign: 'center', 
    marginBottom: 24, 
    lineHeight: 20 
  },
  docTypeContainer: { 
    width: '100%', 
    marginBottom: 24 
  },
  docTypeBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    backgroundColor: '#F9FAFB', 
    borderRadius: 12, 
    marginBottom: 8, 
    borderWidth: 1, 
    borderColor: '#F3F4F6' 
  },
  docTypeBtnActive: { 
    backgroundColor: '#F0F9FF', 
    borderColor: '#BAE6FD' 
  },
  docRadioBtn: { 
    width: 20, 
    height: 20, 
    borderRadius: 10, 
    borderWidth: 2, 
    borderColor: '#D1D5DB', 
    marginRight: 12, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  docRadioBtnActive: { 
    borderColor: COLORS.primary 
  },
  docRadioInner: { 
    width: 10, 
    height: 10, 
    borderRadius: 5, 
    backgroundColor: COLORS.primary 
  },
  docTypeText: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: COLORS.textMain 
  },
  docTypeTextActive: { 
    color: COLORS.primary, 
    fontWeight: '800' 
  },
  docImageContainer: { 
    width: '100%', 
    marginBottom: 24 
  },
  docUploadBtn: { 
    width: '100%', 
    height: 120, 
    borderRadius: 16, 
    borderWidth: 2, 
    borderColor: '#E5E7EB', 
    borderStyle: 'dashed', 
    backgroundColor: '#F9FAFB', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  docUploadIcon: { 
    fontSize: 32, 
    marginBottom: 8 
  },
  docUploadText: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: COLORS.textSub 
  },
  docPreviewWrapper: { 
    width: '100%', 
    alignItems: 'center' 
  },
  docPreviewImage: { 
    width: '100%', 
    height: 160, 
    borderRadius: 16, 
    marginBottom: 12 
  },
  docChangeBtn: { 
    paddingVertical: 8, 
    paddingHorizontal: 16, 
    backgroundColor: '#F3F4F6', 
    borderRadius: 8 
  },
  docChangeText: { 
    fontSize: 12, 
    fontWeight: '800', 
    color: COLORS.textMain 
  },
  modalCard: { 
    width: '100%', 
    backgroundColor: '#FFFFFF', 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    padding: 32, 
    alignItems: 'center', 
    ...SHADOWS.heavy 
  },
  modalHeader: { 
    width: '100%', 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 24, 
    alignItems: 'center' 
  },
  modalTitle: { 
    fontSize: 20, 
    fontWeight: '900', 
    color: COLORS.textMain, 
    letterSpacing: -0.5 
  },
  closeIconText: { 
    fontSize: 20, 
    color: '#A0A0A0', 
    fontWeight: '900' 
  },
  qrContainer: { 
    padding: 24, 
    backgroundColor: '#F8F9FA', 
    borderRadius: 24, 
    marginBottom: 24, 
    width: '100%', 
    alignItems: 'center' 
  },
  qrData: { 
    fontSize: 24, 
    fontWeight: '900', 
    letterSpacing: 2, 
    color: COLORS.textMain 
  },
  modalInfo: { 
    textAlign: 'center', 
    color: COLORS.textSub, 
    fontSize: 14, 
    lineHeight: 22, 
    fontWeight: '500', 
    marginBottom: 24 
  },
  modalActionBtn: { 
    width: '100%', 
    height: 56, 
    borderRadius: 16 
  },
  langModalCard: { 
    backgroundColor: '#FFFFFF', 
    width: '100%', 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    padding: 32, 
    alignItems: 'center', 
    ...SHADOWS.heavy 
  },
  langBtn: { 
    width: '100%', 
    padding: 20, 
    borderRadius: 16, 
    backgroundColor: '#FFFFFF', 
    marginBottom: 12, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#E5E7EB' 
  },
  langBtnActive: { 
    backgroundColor: '#F5FBFF', 
    borderColor: COLORS.primary 
  },
  langText: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: COLORS.textMain 
  },
  langTextActive: { 
    color: COLORS.primary, 
    fontWeight: '900' 
  },
  langBadge: { 
    backgroundColor: '#F5F5F5', 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 8 
  },
  langBadgeActive: { 
    backgroundColor: COLORS.primary 
  },
  langBadgeText: { 
    fontSize: 12, 
    fontWeight: '800', 
    color: COLORS.textSub 
  },
  langBadgeTextActive: { 
    color: '#FFFFFF' 
  },
  notifModalCard: { 
    backgroundColor: '#FFFFFF', 
    width: '100%', 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    padding: 32, 
    alignItems: 'center', 
    ...SHADOWS.heavy 
  },
  notifScrollView: {
    width: '100%', 
    maxHeight: 400
  },
  notifCard: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F5F5F5' 
  },
  notifTextContainer: { 
    flex: 1, 
    paddingRight: 16 
  },
  notifTitle: { 
    fontSize: 14, 
    fontWeight: '800', 
    color: COLORS.textMain, 
    marginBottom: 4 
  },
  notifBody: { 
    fontSize: 12, 
    color: COLORS.textSub, 
    marginBottom: 6, 
    lineHeight: 18 
  },
  notifTime: { 
    fontSize: 10, 
    color: '#A0A0A0', 
    fontWeight: '700' 
  },
  notifUnreadDot: { 
    width: 10, 
    height: 10, 
    borderRadius: 5, 
    backgroundColor: COLORS.primary 
  }
});

export default ProfileScreen;