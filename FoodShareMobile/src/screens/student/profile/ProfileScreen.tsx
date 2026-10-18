import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  RefreshControl,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image
} from 'react-native';

import { launchCamera, launchImageLibrary, Asset } from 'react-native-image-picker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';

// --- CONTEXT & API ---
import { useAuth } from '../../../context/AuthContext';
import { offersApi } from '../../../api/offers';
import { client } from '../../../api/client';
import { notificationsApi } from '../../../api/notifications';
import { authApi } from '../../../api/auth';

// --- CONSTANTS & COMPONENTS ---
import { COLORS } from '../../../constants/theme';
import { Header } from '../../../components/Header';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { toLangUpper } from '../../../utils/text';

// --- LOCAL COMPONENTS & STYLES ---
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
  nextLevelPoints: number;
}

type TabType = 'all' | 'free' | 'discount';

const ProfileScreen = () => {

  // =========================================================
  // HOOKS & GLOBAL CONTEXT
  // =========================================================

  const {
    user,
    logout,
    t,
    lang,
    changeLanguage,
    updateUser,
    refreshUser
  } = useAuth();

  // =========================================================
  // CORE STATE MANAGEMENT
  // =========================================================

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');

  // =========================================================
  // MODALS VISIBILITY STATE
  // =========================================================

  const [selectedQr, setSelectedQr] = useState<string | null>(null);
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [notifications, setNotifications] = useState<
    { id: number; title: string; body: string; time: string; unread: boolean }[]
  >([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [verificationModalVisible, setVerificationModalVisible] = useState(false);

  // =========================================================
  // DOCUMENT UPLOAD STATE
  // =========================================================

  const [docType, setDocType] = useState<
    'student' | 'pensioner' | 'social'
  >('student');

  const [docImage, setDocImage] = useState<Asset | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // =========================================================
  // AVATAR UPLOAD STATE
  // =========================================================

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // =========================================================
  // USER STATISTICS STATE
  // =========================================================

  const [stats, setStats] = useState<UserStats>({
    totalOrders: 0,
    freeCount: 0,
    discountCount: 0,
    points: 0,
    level: 1,
    nextLevelPoints: 100
  });

  // =========================================================
  // NOTIFICATION INBOX
  // =========================================================

  // Loads the stored notifications when the modal opens, then marks them read:
  // unread dots are shown this time and cleared on the next opening.
  const fetchNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    try {
      const items = await notificationsApi.getMine();
      setNotifications(items.map(n => ({
        id: n.id,
        title: n.title,
        body: n.message,
        time: n.date,
        unread: !n.is_read,
      })));
      if (items.some(n => !n.is_read)) {
        await notificationsApi.markAllRead();
      }
    } catch (error: any) {
      console.log('⚠️ Notifications could not be loaded:', error?.message);
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  // =========================================================
  // HELPER FUNCTIONS
  // =========================================================

  const getLevelTitle = (level: number) => {
    if (level >= 10) return t('lvl_legend');
    if (level >= 8) return t('lvl_local_hero');
    if (level >= 5) return t('lvl_eco_warrior');
    if (level >= 3) return t('lvl_food_saver');

    return t('lvl_newbie');
  };

  // =========================================================
  // FETCH HISTORY
  // =========================================================

  // A focus reload and a pull-to-refresh must not overlap (the running request's finally
  // also ends the pull-to-refresh spinner)
  const historyInFlightRef = useRef(false);

  const fetchHistory = useCallback(async () => {

    if (!user?.id || historyInFlightRef.current) return;
    historyInFlightRef.current = true;

    try {

      const res = await offersApi.getHistory(user.id);

      const data: HistoryItem[] = Array.isArray(res.data)
        ? res.data
        : (res.data.history || []);

      setHistory(data);

      const validatedHistory = data.filter(
        i => i.status === 'validated'
      );

      const free = validatedHistory.filter(
        i => i.type === 'free'
      ).length;

      const discount = validatedHistory.filter(
        i => i.type === 'discount'
      ).length;

      // Extract XP and Level from History response
      // or fallback to current user object

      const liveXp =
        res.data.xp !== undefined
          ? res.data.xp
          : ((user as any)?.xp || 0);

      const liveLevel =
        res.data.level !== undefined
          ? res.data.level
          : ((user as any)?.level || 1);

      setStats({
        totalOrders: validatedHistory.length,
        freeCount: free,
        discountCount: discount,
        points: liveXp,
        level: liveLevel,
        nextLevelPoints: liveLevel * 100
      });

    } catch (error: any) {

      // Status/message only: the response body may contain user data
      console.warn(
        'Profile history fetch failed:',
        error.response?.status ?? error.message
      );

    } finally {

      historyInFlightRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }

  }, [user?.id]);

  // =========================================================
  // LOAD ON FOCUS (also the initial load)
  // =========================================================

  // The tab stays mounted, so each time it is shown re-read what can change elsewhere:
  // the account (an admin may have approved the document) and the claim history
  // (a restaurant may have validated a claim). Existing content stays visible meanwhile.
  useFocusEffect(
    useCallback(() => {
      refreshUser();
      fetchHistory();
    }, [refreshUser, fetchHistory])
  );

  // =========================================================
  // PULL TO REFRESH
  // =========================================================

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHistory();
  }, [fetchHistory]);

  // =========================================================
  // FILTER HISTORY
  // =========================================================

  const filteredHistory = useMemo(() => {

    if (activeTab === 'all') {
      return history;
    }

    return history.filter(
      item => item.type === activeTab
    );

  }, [history, activeTab]);

  // One pass over the filtered history instead of six .filter() calls per render
  // (condition, count and list for each section). Same status checks and order as before.
  const { pendingItems, validatedItems } = useMemo(() => {
    const pending: HistoryItem[] = [];
    const validated: HistoryItem[] = [];

    filteredHistory.forEach(item => {
      if (item.status === 'pending') {
        pending.push(item);
      } else if (item.status === 'validated') {
        validated.push(item);
      }
    });

    return { pendingItems: pending, validatedItems: validated };
  }, [filteredHistory]);

  // =========================================================
  // LOGOUT
  // =========================================================

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

  // =========================================================
  // DELETE ACCOUNT
  // =========================================================

  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const deleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      await authApi.deleteAccount();
      // The account no longer exists: drop the local session so the auth stack is shown
      Alert.alert(t('success'), t('delete_account_success'));
      await logout();
    } catch {
      // Always the translated message: the backend's error text is English-only
      Alert.alert(
        t('error'),
        t('delete_account_failed')
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('delete_account_confirm_title'),
      t('delete_account_confirm_msg'),
      [
        { text: t('cancel'), style: "cancel" },
        {
          text: t('delete_account_confirm_btn'),
          style: "destructive",
          onPress: deleteAccount
        }
      ]
    );
  };

  // =========================================================
  // LANGUAGE
  // =========================================================

  const switchLanguage = async (newLang: string) => {

    await changeLanguage(newLang);

    setLangModalVisible(false);
  };

  // =========================================================
  // AVATAR SELECTION
  // =========================================================

  const handleEditProfile = () => {

    Alert.alert(
      t('choose_avatar_method') ||
        "Change Profile Picture",
      "",
      [

        {
          text: t('camera') || "Camera",

          onPress: () => {

            launchCamera(
              {
                mediaType: 'photo',
                quality: 0.5,
                maxWidth: 512,
                maxHeight: 512
              },
              (res) => {

                if (res.assets?.length) {
                  uploadAvatar(res.assets[0]);
                }

              }
            );

          }
        },

        {
          text: t('gallery') || "Gallery",

          onPress: () => {

            launchImageLibrary(
              {
                mediaType: 'photo',
                quality: 0.5,
                maxWidth: 512,
                maxHeight: 512
              },
              (res) => {

                if (res.assets?.length) {
                  uploadAvatar(res.assets[0]);
                }

              }
            );

          }
        },

        {
          text: t('cancel') || "Cancel",
          style: "cancel"
        }

      ]
    );
  };

  // =========================================================
  // AVATAR UPLOAD
  // =========================================================

  const uploadAvatar = async (asset: Asset) => {

    if (!asset || !user?.id) return;

    setUploadingAvatar(true);

    try {

      const formData = new FormData();

      formData.append(
        'user_id',
        String(user.id)
      );

      formData.append(
        'file',
        {
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name:
            asset.fileName ||
            `avatar-${user.id}.jpg`
        } as any
      );

      const response = await client.post(
        '/upload/user-avatar',
        formData,
        {
          headers: {
            'Content-Type':
              'multipart/form-data'
          }
        }
      );

      // Instantly update UI
      // through global context

      if (response.data.success) {

        updateUser({
          ...user,
          avatar_url: response.data.url
        });

        Alert.alert(
          t('success') || "Success",
          t('avatar_updated')
        );
      }

    } catch (error) {

      Alert.alert(
        t('error') || "Error",
        t('avatar_upload_failed')
      );

    } finally {

      setUploadingAvatar(false);
    }
  };

  // =========================================================
  // DOCUMENT IMAGE SELECTION
  // =========================================================

  const handleSelectDocImage = () => {

    Alert.alert(
      t('choose_photo_method') ||
        "Upload Document",
      "",
      [

        {
          text: t('camera') || "Camera",

          onPress: () => {

            launchCamera(
              {
                mediaType: 'photo',
                quality: 0.8
              },
              (res) => {

                if (res.assets?.length) {
                  setDocImage(res.assets[0]);
                }

              }
            );

          }
        },

        {
          text: t('gallery') || "Gallery",

          onPress: () => {

            launchImageLibrary(
              {
                mediaType: 'photo',
                quality: 0.8
              },
              (res) => {

                if (res.assets?.length) {
                  setDocImage(res.assets[0]);
                }

              }
            );

          }
        },

        {
          text: t('cancel') || "Cancel",
          style: "cancel"
        }

      ]
    );
  };

  // =========================================================
  // DOCUMENT UPLOAD
  // =========================================================

  const handleUploadDocument = async () => {

    if (!docImage) {

      return Alert.alert(
        t('error') || "Error",
        t('doc_select_first')
      );
    }

    setUploadingDoc(true);

    try {

      const formData = new FormData();

      formData.append(
        'user_id',
        String(user?.id)
      );

      formData.append(
        'document_type',
        docType
      );

      formData.append(
        'file',
        {
          uri: docImage.uri,
          type:
            docImage.type ||
            'image/jpeg',
          name:
            docImage.fileName ||
            `doc.jpg`
        } as any
      );

      await client.post(
        '/upload/user-document',
        formData,
        {
          headers: {
            'Content-Type':
              'multipart/form-data'
          }
        }
      );

      if (user) {

        updateUser({
          ...user,
          verification_status: 'pending'
        });
      }

      Alert.alert(
        t('success') || "Success!",
        t('msg_verify_sent') ||
          "Your document has been sent."
      );

      setVerificationModalVisible(false);
      setDocImage(null);

    } catch (error) {

      Alert.alert(
        t('error') || "Error",
        t('doc_upload_failed')
      );

    } finally {

      setUploadingDoc(false);
    }
  };

  // =========================================================
  // QUICK MENU
  // =========================================================

  const handleQuickMenuPress = (item: string) => {

    if (item === 'notifications') {

      setNotifModalVisible(true);
      fetchNotifications();

    } else if (item === 'security') {

      if (
        user?.verification_status ===
        'verified'
      ) {

        Alert.alert(
          t('verified') || 'Verified',
          t('already_verified')
        );

      } else {

        setVerificationModalVisible(true);
      }
    }
  };

  // =========================================================
  // PROFILE HEADER
  // =========================================================

  const renderHeader = () => {

    const isVerified =
      user?.verification_status ===
      'verified';

    const isPending =
      user?.verification_status ===
      'pending';

    const progressPercentage =
      stats.points > 0
        ? Math.min(
            (stats.points /
              stats.nextLevelPoints) *
              100,
            100
          )
        : 0;

    return (

      <View style={styles.headerWrapper}>

        {/* =================================================
            PROFILE INFORMATION
        ================================================= */}

        <View style={styles.profileSection}>

          <View style={styles.avatarContainer}>

            {uploadingAvatar ? (

              <ActivityIndicator
                color="#FFFFFF"
                size="large"
              />

            ) : user?.avatar_url ? (

              <Image
                source={{
                  uri: user.avatar_url
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 22
                }}
              />

            ) : (

              <Text style={styles.avatarText}>
                {user?.name
                  ? user.name
                      .charAt(0)
                      .toUpperCase()
                  : 'U'}
              </Text>

            )}

            <TouchableOpacity
              style={styles.editIconBtn}
              onPress={handleEditProfile}
              activeOpacity={0.7}
            >
              <Ionicons
                name="pencil"
                size={14}
                color={COLORS.textMain}
              />
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

              <View
                style={[
                  styles.roleBadge,
                  isVerified
                    ? styles.badgeVerified
                    : (
                        isPending
                          ? styles.badgePending
                          : styles.badgeUnverified
                      )
                ]}
              >

                <Text
                  style={[
                    styles.roleText,
                    isVerified
                      ? styles.textVerified
                      : (
                          isPending
                            ? styles.textPending
                            : styles.textUnverified
                        )
                  ]}
                >
                  {
                    isVerified
                      ? t('verified')
                      : (
                          isPending
                            ? t('pending')
                            : t('unverified')
                        )
                  }
                </Text>

              </View>

            </View>

          </View>

        </View>

        {/* =================================================
            VERIFICATION BANNERS
        ================================================= */}

        {isPending && (

          <View
            style={[
              styles.verificationBanner,
              {
                backgroundColor:
                  '#FFFBEB',
                borderColor:
                  '#FEF08A'
              }
            ]}
          >

            <View
              style={[
                styles.bannerIconBox,
                {
                  backgroundColor:
                    '#FEF08A'
                }
              ]}
            >

              <Ionicons
                name="hourglass-outline"
                size={20}
                color={COLORS.warningText}
              />

            </View>

            <View
              style={
                styles.bannerTextContent
              }
            >

              <Text
                style={[
                  styles.bannerTitle,
                  {
                    color: COLORS.warningText
                  }
                ]}
              >
                {t('pending')}
              </Text>

              <Text
                style={[
                  styles.bannerSub,
                  {
                    color: '#B45309'
                  }
                ]}
              >
                {t('msg_verify_sent')}
              </Text>

            </View>

          </View>
        )}

        {!isVerified &&
          !isPending && (

            <TouchableOpacity
              style={
                styles.verificationBanner
              }
              onPress={() =>
                setVerificationModalVisible(
                  true
                )
              }
            >

              <View
                style={
                  styles.bannerIconBox
                }
              >

                <Ionicons
                  name="alert-circle-outline"
                  size={22}
                  color={COLORS.danger}
                />

              </View>

              <View
                style={
                  styles.bannerTextContent
                }
              >

                <Text
                  style={
                    styles.bannerTitle
                  }
                >
                  {t('unverified')}
                </Text>

                <Text
                  style={
                    styles.bannerSub
                  }
                >
                  {t('verify_action')}
                </Text>

              </View>

              <Ionicons
                name="chevron-forward"
                size={20}
                color={COLORS.danger}
                style={styles.bannerArrow}
              />

            </TouchableOpacity>
          )}

        {/* =================================================
            EXPERIENCE & LEVEL
        ================================================= */}

        <View
          style={
            styles.progressContainer
          }
        >

          <View
            style={
              styles.progressHeader
            }
          >

            <Text
              style={
                styles.levelText
              }
            >
              {t('level_label', { level: stats.level })} •{' '}
              {getLevelTitle(
                stats.level
              )}
            </Text>

            <Text
              style={[
                styles.pointsText,
                {
                  color: COLORS.warningText
                }
              ]}
            >
              {stats.points} /{' '}
              {stats.nextLevelPoints} XP
            </Text>

          </View>

          <View
            style={
              styles.progressBarBg
            }
          >

            <View
              style={[
                styles.progressBarFill,
                {
                  width:
                    `${progressPercentage}%`,
                  backgroundColor:
                    '#F59E0B'
                }
              ]}
            />

          </View>

        </View>

        {/* =================================================
            GAMIFICATION BADGES
        ================================================= */}

        <View
          style={{
            marginTop: 10,
            marginBottom: 20
          }}
        >

          <Text
            style={{
              fontSize: 14,
              fontWeight: '700',
              color: COLORS.textMain,
              marginBottom: 12,
              letterSpacing: 0.5
            }}
          >
            {toLangUpper(t('my_badges'), lang)}
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={{
              gap: 12,
              paddingRight: 20
            }}
          >

            {/* Verified Badge */}

            <View
              style={{
                alignItems: 'center',
                opacity:
                  isVerified ? 1 : 0.4
              }}
            >

              <View
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  backgroundColor:
                    '#ECFDF5',
                  borderWidth: 1,
                  borderColor:
                    '#10B981',
                  justifyContent:
                    'center',
                  alignItems:
                    'center',
                  marginBottom: 4
                }}
              >

                <Ionicons
                  name="shield-checkmark"
                  size={22}
                  color="#10B981"
                />

              </View>

              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color:
                    COLORS.textSub
                }}
              >
                {t('badge_verified')}
              </Text>

            </View>

            {/* First Rescue Badge */}

            <View
              style={{
                alignItems: 'center',
                opacity:
                  stats.totalOrders > 0
                    ? 1
                    : 0.4
              }}
            >

              <View
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  backgroundColor:
                    '#EFF6FF',
                  borderWidth: 1,
                  borderColor:
                    '#3B82F6',
                  justifyContent:
                    'center',
                  alignItems:
                    'center',
                  marginBottom: 4
                }}
              >

                <Ionicons
                  name="leaf"
                  size={22}
                  color="#3B82F6"
                />

              </View>

              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color:
                    COLORS.textSub
                }}
              >
                {t('badge_first_rescue')}
              </Text>

            </View>

            {/* Level 3 Badge */}

            <View
              style={{
                alignItems: 'center',
                opacity:
                  stats.level >= 3
                    ? 1
                    : 0.4
              }}
            >

              <View
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  backgroundColor:
                    '#FFFBEB',
                  borderWidth: 1,
                  borderColor:
                    '#F59E0B',
                  justifyContent:
                    'center',
                  alignItems:
                    'center',
                  marginBottom: 4
                }}
              >

                <Ionicons
                  name="star"
                  size={22}
                  color="#F59E0B"
                />

              </View>

              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color:
                    COLORS.textSub
                }}
              >
                {t('badge_lvl3_saver')}
              </Text>

            </View>

          </ScrollView>

        </View>

        {/* =================================================
            USER SAVINGS STATISTICS
        ================================================= */}

        <View
          style={styles.statsCard}
        >

          <Text
            style={styles.statsTitle}
          >
            {t('savings_report')}
          </Text>

          <View
            style={styles.statsGrid}
          >

            <View
              style={styles.statItem}
            >

              <Text
                style={
                  styles.statValue
                }
              >
                {stats.totalOrders}
              </Text>

              <Text
                style={
                  styles.statLabel
                }
              >
                {t('orders')}
              </Text>

            </View>

            <View
              style={styles.verticalLine}
            />

            <View
              style={styles.statItem}
            >

              <Text
                style={[
                  styles.statValue,
                  {
                    color: COLORS.success
                  }
                ]}
              >
                {stats.freeCount}
              </Text>

              <Text
                style={
                  styles.statLabel
                }
              >
                {t('free_meals')}
              </Text>

            </View>

            <View
              style={styles.verticalLine}
            />

            <View
              style={styles.statItem}
            >

              <Text
                style={[
                  styles.statValue,
                  {
                    color:
                      COLORS.warningText
                  }
                ]}
              >
                {stats.discountCount}
              </Text>

              <Text
                style={
                  styles.statLabel
                }
              >
                {t('discount_meals')}
              </Text>

            </View>

          </View>

        </View>

        {/* =================================================
            QUICK ACTIONS
        ================================================= */}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          style={styles.quickMenu}
        >

          {[
            'notifications',
            'security'
          ].map((item) => (

            <TouchableOpacity
              key={item}
              style={
                styles.menuChip
              }
              onPress={() =>
                handleQuickMenuPress(
                  item
                )
              }
            >

              <Text
                style={
                  styles.menuText
                }
              >
                {toLangUpper(t(item), lang)}
              </Text>

            </TouchableOpacity>

          ))}

        </ScrollView>

        {/* =================================================
            HISTORY FILTER TABS
        ================================================= */}

        <View
          style={
            styles.tabsContainer
          }
        >

          {(
            [
              'all',
              'free',
              'discount'
            ] as TabType[]
          ).map((tab) => (

            <TouchableOpacity
              key={tab}
              style={[
                styles.tabBtn,
                activeTab === tab &&
                  styles.tabActive
              ]}
              onPress={() =>
                setActiveTab(tab)
              }
            >

              <Text
                style={[
                  styles.tabText,
                  activeTab === tab &&
                    styles.tabTextActive
                ]}
              >
                {toLangUpper(t(tab), lang)}
              </Text>

            </TouchableOpacity>

          ))}

        </View>

      </View>
    );
  };

  // =========================================================
  // MAIN RENDER
  // =========================================================

  return (

    <View style={styles.container}>

      <StatusBar
        barStyle="dark-content"
        backgroundColor={
          COLORS.background
        }
      />

      <Header
        title={t('nav_profile')}
        rightIcon="language-outline"
        rightIconLabel={t('lang_change')}
        onRightPress={() =>
          setLangModalVisible(true)
        }
      />

      {loading ? (

        <View
          style={
            styles.centerBox
          }
        >

          <ActivityIndicator
            size="large"
            color={
              COLORS.primary
            }
          />

          <Text
            style={
              styles.loadingText
            }
          >
            {t('loading')}
          </Text>

        </View>

      ) : (

        /*
         * IMPORTANT:
         *
         * The entire Profile content is inside ONE ScrollView.
         * Logout is also inside this ScrollView.
         *
         * This prevents the fixed footer from covering
         * the history cards and allows the user to reach
         * every item at the bottom of the page.
         */

        <ScrollView
          contentContainerStyle={{
            paddingBottom: 140
          }}
          showsVerticalScrollIndicator={
            false
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={
                COLORS.primary
              }
            />
          }
        >

          {/* =================================================
              PROFILE HEADER
          ================================================= */}

          {renderHeader()}

          {/* =================================================
              EMPTY STATE
          ================================================= */}

          {filteredHistory.length === 0 && (

            <EmptyState
              icon="receipt-outline"
              title={t('empty_history')}
            />
          )}

          {/* =================================================
              PENDING OFFERS
          ================================================= */}

          {pendingItems.length > 0 && (

            <View
              style={
                styles.listSection
              }
            >

              <Text
                style={[
                  styles.sectionHeaderTitle,
                  {
                    color: COLORS.warningText
                  }
                ]}
              >
                {t('pending_offers')} (
                {
                  pendingItems.length
                }
                )
              </Text>

              {pendingItems
                .map((item) => (

                  <HistoryCard
                    key={item.id}
                    item={item}
                    onPress={() =>
                      setSelectedQr(
                        item.qr_code
                      )
                    }
                    t={t}
                  />

                ))}

            </View>
          )}

          {/* =================================================
              VALIDATED OFFERS
          ================================================= */}

          {validatedItems.length > 0 && (

            <View
              style={
                styles.listSection
              }
            >

              <Text
                style={[
                  styles.sectionHeaderTitle,
                  {
                    color: COLORS.success
                  }
                ]}
              >
                {t('validated_offers')} (
                {
                  validatedItems.length
                }
                )
              </Text>

              {validatedItems
                .map((item) => (

                  <HistoryCard
                    key={item.id}
                    item={item}
                    onPress={() =>
                      setSelectedQr(
                        item.qr_code
                      )
                    }
                    t={t}
                  />

                ))}

            </View>
          )}

          {/* =================================================
              LOGOUT
              MOVED INSIDE SCROLLVIEW
          ================================================= */}

          <View
            style={styles.footer}
          >

            <Button
              title={t('logout')}
              onPress={handleLogout}
              variant="dangerSoft"
              style={
                styles.logoutBtn
              }
            />

            <Button
              title={t('delete_account')}
              onPress={handleDeleteAccount}
              loading={isDeletingAccount}
              variant="outline"
              style={
                styles.deleteAccountBtn
              }
              textStyle={
                styles.logoutText
              }
            />

          </View>

        </ScrollView>

      )}

      {/* =====================================================
          MODALS
      ===================================================== */}

      <LanguageModal
        visible={
          langModalVisible
        }
        onClose={() =>
          setLangModalVisible(
            false
          )
        }
        currentLang={lang}
        onSelectLanguage={
          switchLanguage
        }
        t={t}
      />

      <NotificationModal
        visible={
          notifModalVisible
        }
        onClose={() =>
          setNotifModalVisible(
            false
          )
        }
        notifications={
          notifications
        }
        loading={
          notificationsLoading
        }
        t={t}
      />

      <QrModal
        visible={
          !!selectedQr
        }
        onClose={() =>
          setSelectedQr(null)
        }
        qrCode={
          selectedQr
        }
        item={history.find(h => h.qr_code === selectedQr) || null}
        t={t}
      />

      <VerificationModal
        visible={
          verificationModalVisible
        }
        onClose={() =>
          setVerificationModalVisible(
            false
          )
        }
        t={t}
        docType={docType}
        setDocType={setDocType}
        docImage={docImage}
        onSelectImage={
          handleSelectDocImage
        }
        onUpload={
          handleUploadDocument
        }
        uploadingDoc={
          uploadingDoc
        }
      />

    </View>
  );
};

export default ProfileScreen;