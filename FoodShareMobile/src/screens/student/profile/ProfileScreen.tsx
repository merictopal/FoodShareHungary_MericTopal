import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, RefreshControl, TouchableOpacity, StatusBar, Alert, ActivityIndicator, ScrollView, Image } from 'react-native';
import { launchCamera, launchImageLibrary, Asset } from 'react-native-image-picker';

// Context & API
import { useAuth } from '../../../context/AuthContext';
import { offersApi } from '../../../api/offers';
import { client } from '../../../api/client'; 

// Constants & Components
import { COLORS } from '../../../constants/theme';
import { Header } from '../../../components/Header';
import { Button } from '../../../components/Button';

// Local Components & Styles
import { styles } from './styles';
import { HistoryCard, HistoryItem } from './components/HistoryCard';
import { LanguageModal } from './components/LanguageModal';
import { NotificationModal } from './components/NotificationModal';
import { QrModal } from './components/QrModal';
import { VerificationModal } from './components/VerificationModal';

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

const ProfileScreen = ({ navigation }: any) => {
  const { user, logout, t, lang, changeLanguage, updateUser } = useAuth();  
  
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  
  // Modals Visibility
  const [selectedQr, setSelectedQr] = useState<string | null>(null);
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [verificationModalVisible, setVerificationModalVisible] = useState(false);
  
  // Doc Upload State
  const [docType, setDocType] = useState<'student' | 'pensioner' | 'social'>('student');
  const [docImage, setDocImage] = useState<Asset | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  
  // 🚀 NEW: Avatar Upload State
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  const [stats, setStats] = useState<UserStats>({ 
    totalOrders: 0, freeCount: 0, discountCount: 0, points: 0, level: 1, rank: 0, nextLevelPoints: 100 
  });

  const mockNotifications = [
    { id: 1, title: 'Welcome to FoodShare! 🎉', body: 'Start exploring offers around you.', time: 'Just now', unread: true },
    { id: 2, title: 'New Level Unlocked', body: 'You reached a new Level!', time: '2 hours ago', unread: false }
  ];

  const getLevelTitle = (level: number) => {
    if (level >= 10) return t('lvl_legend');
    if (level >= 8) return t('lvl_local_hero');
    if (level >= 5) return t('lvl_eco_warrior');
    if (level >= 3) return t('lvl_food_saver');
    return t('lvl_newbie');
  };

  // --- FETCH HISTORY (WITH DETAILED DEBUGGING) ---
  const fetchHistory = async () => {
    if (!user?.id) return;
    
    try {
      // 1. Fetching user details
      console.log(`🔄 [DEBUG] Fetching user details for ID: ${user.id}...`);
      const userRes = await client.get(`/auth/me/${user.id}`); 
      
      if (userRes.data && userRes.data.user) {
        updateUser(userRes.data.user);
      }
      
      // 2. Fetching user history
      console.log(`🔄 [DEBUG] Fetching history for ID: ${user.id}...`);
      const res = await offersApi.getHistory(user.id);
      
      const data: HistoryItem[] = Array.isArray(res.data) ? res.data : (res.data.history || []);
      setHistory(data);
      
      const validatedHistory = data.filter(i => i.status === 'validated');
      const free = validatedHistory.filter(i => i.type === 'free').length;
      const discount = validatedHistory.filter(i => i.type === 'discount').length;
      const liveXp = res.data.xp !== undefined ? res.data.xp : ((user as any)?.xp || 0);
      const liveLevel = res.data.level !== undefined ? res.data.level : ((user as any)?.level || 1);
      
      setStats({
        totalOrders: validatedHistory.length,
        freeCount: free,
        discountCount: discount,
        points: liveXp,
        level: liveLevel,
        rank: liveXp > 0 ? Math.max(1, 500 - Math.floor(liveXp / 10)) : 0,
        nextLevelPoints: liveLevel * 100
      });
      
      console.log(`✅ [DEBUG] Profile data fetched successfully!`);

    } catch (error: any) {
      // --- REAL ERROR LOGGING (NO MOCKS) ---
      console.log("❌ [DEBUG] PROFILE FETCH FAILED!");
      
      if (error.response) {
        // The request was made and the server responded with a status code outside the 2xx range
        console.log("🚨 Status Code:", error.response.status);
        console.log("🚨 Backend Response:", JSON.stringify(error.response.data, null, 2));
        console.log("🚨 Failed Endpoint:", error.config?.url);
      } else if (error.request) {
        // The request was made but no response was received (Network error, CORS, Server down)
        console.log("🚨 No response received from backend. Is the server running and accessible?");
      } else {
        // Something happened in setting up the request that triggered an Error
        console.log("🚨 Axios Error Message:", error.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHistory();
  }, []);

  const filteredHistory = useMemo(() => {
    if (activeTab === 'all') return history;
    return history.filter(item => item.type === activeTab);
  }, [history, activeTab]);

  const handleLogout = () => {
    Alert.alert(t('logout'), t('logout_confirm_msg'), [
      { text: t('cancel'), style: "cancel" },
      { text: t('logout'), style: "destructive", onPress: logout }
    ]);
  };

  const switchLanguage = async (newLang: string) => {
    await changeLanguage(newLang);
    setLangModalVisible(false);
  };

  // 🚀 NEW: Avatar Selection & Upload Logic
  const handleEditProfile = () => {
    Alert.alert(t('choose_avatar_method') || "Change Profile Picture", "", [
      { 
        text: t('camera') || "Camera", 
        onPress: () => { 
          launchCamera({ mediaType: 'photo', quality: 0.5 }, (res) => { 
            if (res.assets?.length) uploadAvatar(res.assets[0]); 
          }); 
        } 
      },
      { 
        text: t('gallery') || "Gallery", 
        onPress: () => { 
          launchImageLibrary({ mediaType: 'photo', quality: 0.5 }, (res) => { 
            if (res.assets?.length) uploadAvatar(res.assets[0]); 
          }); 
        } 
      },
      { text: t('cancel') || "Cancel", style: "cancel" }
    ]);
  };

  const uploadAvatar = async (asset: Asset) => {
    if (!asset || !user?.id) return;
    setUploadingAvatar(true);
    
    try {
      const formData = new FormData();
      formData.append('user_id', String(user.id));
      formData.append('file', { 
        uri: asset.uri, 
        type: asset.type || 'image/jpeg', 
        name: asset.fileName || `avatar-${user.id}.jpg` 
      } as any);

      // Call our brand new backend API route
      const response = await client.post('/upload/user-avatar', formData, { 
        headers: { 'Content-Type': 'multipart/form-data' } 
      });
      
      // Update global AuthContext with the new avatar URL so it shows instantly
      if (response.data.success) {
        updateUser({ ...user, avatar_url: response.data.url });
        Alert.alert(t('success') || "Success", "Profile picture updated!");
      }
    } catch (error) {
      Alert.alert(t('error') || "Error", "Failed to upload profile picture.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSelectDocImage = () => {
    Alert.alert(t('choose_photo_method') || "Upload Document", "", [
      { text: t('camera') || "Camera", onPress: () => { launchCamera({ mediaType: 'photo', quality: 0.8 }, (res) => { if (res.assets?.length) setDocImage(res.assets[0]); }); } },
      { text: t('gallery') || "Gallery", onPress: () => { launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, (res) => { if (res.assets?.length) setDocImage(res.assets[0]); }); } },
      { text: t('cancel') || "Cancel", style: "cancel" }
    ]);
  };

  const handleUploadDocument = async () => {
    if (!docImage) return Alert.alert(t('error') || "Error", "Please select or capture a document photo first.");
    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append('user_id', String(user?.id));
      formData.append('document_type', docType);
      formData.append('file', { uri: docImage.uri, type: docImage.type || 'image/jpeg', name: docImage.fileName || `doc.jpg` } as any);
      await client.post('/upload/user-document', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (user) updateUser({ ...user, verification_status: 'pending' });
      Alert.alert(t('success') || "Success!", t('msg_verify_sent') || "Your document has been sent.");
      setVerificationModalVisible(false);
      setDocImage(null); 
    } catch (error) {
      Alert.alert(t('error') || "Error", "Failed to upload document.");
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleQuickMenuPress = (item: string) => {
    if (item === 'notifications') setNotifModalVisible(true);
    else if (item === 'security') {
      if (user?.verification_status === 'verified') Alert.alert(t('verified') || 'Verified', 'Your account is already securely verified! ✅');
      else setVerificationModalVisible(true);
    } else Alert.alert(t(item).toUpperCase(), "This feature will be available soon!");
  };

const renderHeader = () => {
    const isVerified = user?.verification_status === 'verified';
    const isPending = user?.verification_status === 'pending';
    const progressPercentage = stats.points > 0 ? Math.min((stats.points / stats.nextLevelPoints) * 100, 100) : 0;

    return (
      <View style={styles.headerWrapper}>
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
             {uploadingAvatar ? (
               <ActivityIndicator color="#FFFFFF" size="large" />
             ) : user?.avatar_url ? (
               <Image source={{ uri: user.avatar_url }} style={{ width: '100%', height: '100%', borderRadius: 22 }} />
             ) : (
               <Text style={styles.avatarText}>{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</Text>
             )}
             
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
               <View style={[styles.roleBadge, isVerified ? styles.badgeVerified : (isPending ? styles.badgePending : styles.badgeUnverified)]}>
                 <Text style={[styles.roleText, isVerified ? styles.textVerified : (isPending ? styles.textPending : styles.textUnverified)]}>
                    {isVerified ? t('verified') : (isPending ? t('pending') : t('unverified'))}
                 </Text>
               </View>
               <View style={[styles.roleBadge, styles.rankBadge]}>
                 <Text style={styles.rankText}>RANK #{stats.rank || '--'}</Text>
               </View>
            </View>
          </View>
        </View>

        {isPending && (
          <View style={[styles.verificationBanner, { backgroundColor: '#FFFBEB', borderColor: '#FEF08A' }]}>
            <View style={[styles.bannerIconBox, { backgroundColor: '#FEF08A' }]}>
              <Text style={[styles.bannerIconText, { color: '#D97706' }]}>⏳</Text>
            </View>
            <View style={styles.bannerTextContent}>
              <Text style={[styles.bannerTitle, { color: '#D97706' }]}>{t('pending')}</Text>
              <Text style={[styles.bannerSub, { color: '#B45309' }]}>{t('msg_verify_sent')}</Text>
            </View>
          </View>
        )}

        {!isVerified && !isPending && (
          <TouchableOpacity style={styles.verificationBanner} onPress={() => setVerificationModalVisible(true)}>
            <View style={styles.bannerIconBox}><Text style={styles.bannerIconText}>!</Text></View>
            <View style={styles.bannerTextContent}>
              <Text style={styles.bannerTitle}>{t('unverified')}</Text>
              <Text style={styles.bannerSub}>{t('verify_action')}</Text>
            </View>
            <Text style={styles.bannerArrow}>➤</Text>
          </TouchableOpacity>
        )}

        {/* 🚀 FIXED: XP and Progress Bar are now Gold/Amber instead of Red for positive reinforcement */}
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.levelText}>LEVEL {stats.level} • {getLevelTitle(stats.level)}</Text>
            <Text style={[styles.pointsText, { color: '#F59E0B' }]}>{stats.points} / {stats.nextLevelPoints} XP</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercentage}%`, backgroundColor: '#F59E0B' }]} />
          </View>
        </View>

        {/* 🚀 NEW: Gamification Badges Section */}
        <View style={{ marginTop: 10, marginBottom: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.textMain, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {t('my_badges') || "My Badges"}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 20 }}>
             
             {/* Verified Badge */}
             <View style={{ alignItems: 'center', opacity: isVerified ? 1 : 0.4 }}>
               <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#10B981', justifyContent: 'center', alignItems: 'center', marginBottom: 4 }}>
                 <Text style={{ fontSize: 20 }}>🛡️</Text>
               </View>
               <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.textSub }}>Verified</Text>
             </View>

             {/* First Rescue Badge */}
             <View style={{ alignItems: 'center', opacity: stats.totalOrders > 0 ? 1 : 0.4 }}>
               <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginBottom: 4 }}>
                 <Text style={{ fontSize: 20 }}>🌱</Text>
               </View>
               <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.textSub }}>1st Rescue</Text>
             </View>

             {/* Level 3 Badge (Locked/Unlocked) */}
             <View style={{ alignItems: 'center', opacity: stats.level >= 3 ? 1 : 0.4 }}>
               <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#F59E0B', justifyContent: 'center', alignItems: 'center', marginBottom: 4 }}>
                 <Text style={{ fontSize: 20 }}>⭐</Text>
               </View>
               <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.textSub }}>Lv 3 Saver</Text>
             </View>
             
          </ScrollView>
        </View>

        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>{t('savings_report')}</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}><Text style={styles.statValue}>{stats.totalOrders}</Text><Text style={styles.statLabel}>{t('orders')}</Text></View>
            <View style={styles.verticalLine} />
            <View style={styles.statItem}><Text style={[styles.statValue, { color: '#F59E0B' }]}>{stats.points}</Text><Text style={styles.statLabel}>TOTAL XP</Text></View>
            <View style={styles.verticalLine} />
            <View style={styles.statItem}><Text style={[styles.statValue, { color: COLORS.success }]}>{stats.freeCount}</Text><Text style={styles.statLabel}>{t('free_meals')}</Text></View>
          </View>
        </View>

        {/* 🚀 FIXED: Improved Contrast for Free/Discount Blocks */}
        <View style={styles.detailedStatsWrapper}>
          <View style={styles.detailedStatsContainer}>
            <View style={[styles.detailedStatHalf, { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#10B981' }]}>
              <Text style={[styles.detailedStatTitle, { color: '#047857' }]}>{t('free_meals').toUpperCase()}</Text>
              <Text style={[styles.detailedStatValue, { color: '#047857' }]}>{stats.freeCount}</Text>
            </View>
            <View style={[styles.detailedStatHalf, { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#EA580C' }]}>
              <Text style={[styles.detailedStatTitle, { color: '#C2410C' }]}>{t('discount_meals').toUpperCase()}</Text>
              <Text style={[styles.detailedStatValue, { color: '#C2410C' }]}>{stats.discountCount}</Text>
            </View>
          </View>
          <View style={styles.totalBadgeContainer}><Text style={styles.totalBadgeText}>{t('total_offers')}: {stats.freeCount + stats.discountCount}</Text></View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickMenu}>
          {['notifications', 'security', 'help'].map((item) => (
             <TouchableOpacity key={item} style={styles.menuChip} onPress={() => handleQuickMenuPress(item)}>
                <Text style={styles.menuText}>{t(item).toUpperCase()}</Text>
             </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.tabsContainer}>
          {(['all', 'free', 'discount'] as TabType[]).map((tab) => (
            <TouchableOpacity key={tab} style={[styles.tabBtn, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{t(tab)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <Header title={t('nav_profile')} onBack={() => navigation.goBack()} rightIcon={lang ? lang.toUpperCase() : 'EN'} onRightPress={() => setLangModalVisible(true)} />

      {loading ? (
        <View style={styles.centerBox}><ActivityIndicator size="large" color={COLORS.primary} /><Text style={styles.loadingText}>Loading...</Text></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}>
          {renderHeader()}
          
          {filteredHistory.length === 0 && (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconCircle}><Text style={styles.emptyIconText}>!</Text></View>
              <Text style={styles.emptyTitle}>{t('empty_list')}</Text>
            </View>
          )}

          {filteredHistory.filter(i => i.status === 'pending').length > 0 && (
            <View style={styles.listSection}>
              <Text style={[styles.sectionHeaderTitle, { color: '#F39C12' }]}>{t('pending_offers')} ({filteredHistory.filter(i => i.status === 'pending').length})</Text>
              {filteredHistory.filter(i => i.status === 'pending').map((item) => (
                <HistoryCard key={item.id} item={item} onPress={() => setSelectedQr(item.qr_code)} t={t} />
              ))}
            </View>
          )}

          {filteredHistory.filter(i => i.status === 'validated').length > 0 && (
            <View style={styles.listSection}>
              <Text style={[styles.sectionHeaderTitle, { color: '#2ECC71' }]}>{t('validated_offers')} ({filteredHistory.filter(i => i.status === 'validated').length})</Text>
              {filteredHistory.filter(i => i.status === 'validated').map((item) => (
                <HistoryCard key={item.id} item={item} onPress={() => setSelectedQr(item.qr_code)} t={t} />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <View style={styles.footer}>
         <Button title={t('logout')} onPress={handleLogout} variant="secondary" style={styles.logoutBtn} textStyle={styles.logoutText}/>
      </View>

      <LanguageModal visible={langModalVisible} onClose={() => setLangModalVisible(false)} currentLang={lang} onSelectLanguage={switchLanguage} t={t} />
      <NotificationModal visible={notifModalVisible} onClose={() => setNotifModalVisible(false)} notifications={mockNotifications} t={t} />
      <QrModal visible={!!selectedQr} onClose={() => setSelectedQr(null)} qrCode={selectedQr} t={t} />
      <VerificationModal 
        visible={verificationModalVisible} onClose={() => setVerificationModalVisible(false)} t={t} 
        docType={docType} setDocType={setDocType} docImage={docImage} 
        onSelectImage={handleSelectDocImage} onUpload={handleUploadDocument} uploadingDoc={uploadingDoc} 
      />
    </View>
  );
};

export default ProfileScreen;