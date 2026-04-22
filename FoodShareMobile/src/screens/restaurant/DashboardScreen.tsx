import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Alert, 
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Image,
  ActivityIndicator
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { offersApi } from '../../api/offers';
import { client } from '../../api/client';
import { COLORS, SHADOWS } from '../../constants/theme';
import { Header } from '../../components/Header';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { LeaderboardModal } from '../../components/LeaderboardModal';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { launchCamera, launchImageLibrary, Asset } from 'react-native-image-picker';

const DashboardScreen = () => {
  const { user, logout, t, changeLanguage, lang, updateUser } = useAuth();
  const navigation = useNavigation<any>();

  const [activeTab, setActiveTab] = useState<'free' | 'discount'>('free');
  const [qrCode, setQrCode] = useState('');
  const [title, setTitle] = useState('');
  const [qty, setQty] = useState('1');
  const [discount, setDiscount] = useState('');
  const [photo, setPhoto] = useState<Asset | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isLeaderboardVisible, setIsLeaderboardVisible] = useState(false);

  // State for the restaurant's own active offers list
  const [myOffers, setMyOffers] = useState<any[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);

  // Fetch the restaurant's own active offers from the backend
  const fetchMyOffers = async () => {
    if (!user?.id) return;
    setLoadingOffers(true);
    try {
      const res = await offersApi.getMyOffers(user.id);
      setMyOffers(res.data?.offers || []);
    } catch (e) {
      // Silently fail — the dashboard stays usable even if this endpoint is slow
      console.warn('fetchMyOffers failed:', e);
    } finally {
      setLoadingOffers(false);
    }
  };

  // Refresh the offers list every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchMyOffers();
    }, [user?.id])
  );

  const handleDeleteOffer = async (offerId: number) => {
    Alert.alert(
      t('delete_offer') || 'Remove Offer',
      t('delete_offer_confirm') || 'Are you sure you want to remove this offer?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete') || 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await offersApi.deleteOffer(offerId, user!.id);
              // Optimistically remove from local state without a full refetch
              setMyOffers(prev => prev.filter(o => o.id !== offerId));
            } catch (e) {
              Alert.alert(t('error'), 'Could not remove offer.');
            }
          }
        }
      ]
    );
  };

  const handleSelectImage = () => {
    Keyboard.dismiss();
    Alert.alert(
      t('add_photo') || 'Add Photo',
      t('choose_photo_method') || 'Choose a method to add a photo of your meal',
      [
        {
          text: t('camera') || 'Take Photo',
          onPress: () => {
            launchCamera({ mediaType: 'photo', quality: 0.8 }, (response) => {
              if (response.assets && response.assets.length > 0) {
                setPhoto(response.assets[0]);
              }
            });
          }
        },
        {
          text: t('gallery') || 'Choose from Gallery',
          onPress: () => {
            launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, (response) => {
              if (response.assets && response.assets.length > 0) {
                setPhoto(response.assets[0]);
              }
            });
          }
        },
        { text: t('cancel') || 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleEditAvatar = () => {
    Alert.alert(t('choose_avatar_method') || 'Change Profile Picture', '', [
      {
        text: t('camera') || 'Camera',
        onPress: () => {
          launchCamera({ mediaType: 'photo', quality: 0.5 }, (res) => {
            if (res.assets?.length) uploadAvatar(res.assets[0]);
          });
        }
      },
      {
        text: t('gallery') || 'Gallery',
        onPress: () => {
          launchImageLibrary({ mediaType: 'photo', quality: 0.5 }, (res) => {
            if (res.assets?.length) uploadAvatar(res.assets[0]);
          });
        }
      },
      { text: t('cancel') || 'Cancel', style: 'cancel' }
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

      const response = await client.post('/upload/user-avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        updateUser({ ...user, avatar_url: response.data.url });
        Alert.alert(t('success') || 'Success', 'Profile picture updated!');
      }
    } catch (error) {
      Alert.alert(t('error') || 'Error', 'Failed to upload profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleVerify = async () => {
    if (!qrCode.trim()) {
      Alert.alert(t('error'), 'Invalid code.');
      return;
    }

    setLoading(true);
    Keyboard.dismiss();

    try {
      const res = await offersApi.verifyQr(qrCode.trim());
      Alert.alert(t('success'), `+${res.data?.points || 10} ${t('saved')}!`);
      setQrCode('');
    } catch (e: any) {
      const errorMsg = e.response?.data?.message || t('error');
      Alert.alert(t('error'), errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert(t('error'), 'Missing information.');
      return;
    }

    setLoading(true);
    Keyboard.dismiss();

    try {
      const quantityNum = parseInt(qty) || 1;
      const discountValue = activeTab === 'free' ? 0 : (parseInt(discount) || 0);

      const offerData = {
        user_id: user?.id,
        title: title.trim(),
        description: title.trim(),
        type: activeTab,
        quantity: quantityNum,
        discount_rate: discountValue
      };

      if (photo) {
        await offersApi.createWithImage(offerData, photo);
      } else {
        await offersApi.create(offerData);
      }

      Alert.alert(t('success'), t('msg_offer_published'));

      // Reset the form fields
      setTitle('');
      setQty('1');
      setDiscount('');
      setActiveTab('free');
      setPhoto(null);

      // Immediately refresh the active offers list after a successful publish
      fetchMyOffers();

    } catch (e: any) {
      const errorMsg = e.response?.data?.message || t('error');
      Alert.alert(t('error'), errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setIsSettingsVisible(false);
    Alert.alert(
      t('logout'),
      t('logout_confirm_msg'),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('logout'), style: 'destructive', onPress: logout }
      ]
    );
  };

  const renderAvatar = (isModal = false) => {
    const initial = user?.name ? user.name.charAt(0).toUpperCase() : 'R';
    const containerStyle = isModal ? styles.modalAvatarContainer : styles.headerAvatarContainer;
    const textStyle = isModal ? styles.modalAvatarText : styles.headerAvatarText;
    const imageStyle = isModal ? styles.modalAvatarImage : styles.headerAvatarImage;

    return (
      <View style={containerStyle}>
        {uploadingAvatar ? (
          <ActivityIndicator color="#FFFFFF" size={isModal ? 'large' : 'small'} />
        ) : user?.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={imageStyle} />
        ) : (
          <Text style={textStyle}>{initial}</Text>
        )}

        {isModal && (
          <TouchableOpacity style={styles.editAvatarBtn} onPress={handleEditAvatar} activeOpacity={0.7}>
            <Text style={styles.editAvatarText}>✎</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header
        title={t('nav_rest')}
        rightIcon={renderAvatar()}
        onRightPress={() => setIsSettingsVisible(true)}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.welcomeSection, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
          <View>
            <Text style={styles.welcomeSub}>{t('hello')},</Text>
            <Text style={styles.welcomeTitle}>{user?.name}</Text>
          </View>

          <TouchableOpacity
            style={styles.leaderboardBtn}
            onPress={() => setIsLeaderboardVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.leaderboardBtnText}>🏆 {t('leaderboard') || 'Rankings'}</Text>
          </TouchableOpacity>
        </View>

        {/* QR Verification Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('verify_qr')}</Text>
          <Text style={styles.cardDescription}>{t('desc_verify_qr')}</Text>

          <View style={styles.row}>
            <View style={styles.inputFlex}>
              <Input
                placeholder={t('qr_ph')}
                value={qrCode}
                onChangeText={setQrCode}
                autoCapitalize="characters"
              />
            </View>
            <Button
              title="Scan QR"
              onPress={() => navigation.navigate('Scanner')}
              style={styles.scanBtn}
              textStyle={styles.scanBtnText}
            />
            <Button
              title={t('verify_btn')}
              onPress={handleVerify}
              loading={loading}
              style={styles.verifyBtn}
              textStyle={styles.verifyBtnText}
            />
          </View>
        </View>

        {/* Add New Offer Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('add_offer')}</Text>
          <Text style={styles.cardDescription}>{t('desc_add_offer')}</Text>

          <View style={styles.sliderContainer}>
            <TouchableOpacity
              style={[styles.sliderBtn, activeTab === 'free' && styles.sliderBtnActive]}
              onPress={() => setActiveTab('free')}
              activeOpacity={0.7}
            >
              <Text style={[styles.sliderText, activeTab === 'free' && styles.sliderTextActive]}>
                {t('type_free')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sliderBtn, activeTab === 'discount' && styles.sliderBtnActive]}
              onPress={() => setActiveTab('discount')}
              activeOpacity={0.7}
            >
              <Text style={[styles.sliderText, activeTab === 'discount' && styles.sliderTextActive]}>
                {t('type_discount')}
              </Text>
            </TouchableOpacity>
          </View>

          <Input
            label={t('prod_name_ph')}
            value={title}
            onChangeText={setTitle}
            placeholder={t('ph_offer_name')}
          />

          <View style={styles.row}>
            <View style={styles.inputFlex}>
              <Input
                label={t('qty_ph')}
                value={qty}
                onChangeText={setQty}
                keyboardType="numeric"
              />
            </View>

            {activeTab === 'discount' && (
              <View style={[styles.inputFlex, { marginLeft: 12 }]}>
                <Input
                  label={t('disc_ph')}
                  value={discount}
                  onChangeText={setDiscount}
                  keyboardType="numeric"
                  placeholder="20"
                />
              </View>
            )}
          </View>

          <View style={styles.publishSpacing} />

          {/* Meal Photo Picker */}
          <View style={styles.imagePickerContainer}>
            {photo?.uri ? (
              <View style={styles.previewContainer}>
                <Image source={{ uri: photo.uri }} style={styles.previewImage} />
                <TouchableOpacity onPress={handleSelectImage} style={styles.changePhotoBtn}>
                  <Text style={styles.changePhotoText}>{t('change_photo') || 'Change Photo'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={handleSelectImage} style={styles.addPhotoBtn}>
                <Text style={styles.addPhotoBtnText}>📸 {t('add_photo') || '+ Add Meal Photo'}</Text>
              </TouchableOpacity>
            )}
          </View>

          <Button
            title={t('publish')}
            onPress={handleCreate}
            loading={loading}
          />
        </View>

        {/* Active Offers List Card */}
        <View style={styles.card}>
          <View style={styles.myOffersHeader}>
            <Text style={styles.cardTitle}>{t('my_offers') || 'My Active Offers'}</Text>
            <TouchableOpacity onPress={fetchMyOffers} activeOpacity={0.7}>
              <Text style={styles.refreshBtn}>{t('refresh') || '↻ Refresh'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.cardDescription}>
            {t('desc_my_offers') || 'Your currently active listings. Tap × to remove one.'}
          </Text>

          {loadingOffers ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
          ) : myOffers.length === 0 ? (
            <View style={styles.emptyOffersBox}>
              <Text style={styles.emptyOffersText}>
                {t('no_active_offers') || '🍽️ No active offers yet. Add one above!'}
              </Text>
            </View>
          ) : (
            myOffers.map(offer => (
              <View key={offer.id} style={styles.myOfferRow}>
                <View style={[
                  styles.myOfferTypeBadge,
                  { backgroundColor: offer.type === 'free' ? '#E1F7E9' : '#FFF3E0' }
                ]}>
                  <Text style={{
                    fontSize: 10,
                    fontWeight: '800',
                    color: offer.type === 'free' ? COLORS.success : COLORS.warning
                  }}>
                    {offer.type === 'free' ? (t('free') || 'FREE') : `-%${offer.discount_rate}`}
                  </Text>
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.myOfferTitle} numberOfLines={1}>{offer.title}</Text>
                  <Text style={styles.myOfferStock}>
                    🔥 {offer.quantity_left} {t('left') || 'left'}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => handleDeleteOffer(offer.id)}
                  style={styles.myOfferDeleteBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.myOfferDeleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Settings / Profile Modal */}
      <Modal
        visible={isSettingsVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsSettingsVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsSettingsVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContent}>

                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{t('nav_profile')}</Text>
                  <TouchableOpacity
                    onPress={() => setIsSettingsVisible(false)}
                    style={styles.closeBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.closeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.profileInfoBox}>
                  {renderAvatar(true)}
                  <Text style={styles.profileName}>{user?.name}</Text>
                  <Text style={styles.profileRole}>{t('role_rest')}</Text>
                </View>

                <Text style={styles.sectionLabel}>{t('lang_change')}</Text>
                <View style={styles.langContainer}>
                  {['tr', 'en', 'hu'].map((l) => (
                    <TouchableOpacity
                      key={l}
                      onPress={() => changeLanguage(l)}
                      style={[styles.langBtn, lang === l && styles.langBtnActive]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.langText, lang === l && styles.langTextActive]}>
                        {l.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.logoutBtn}
                  onPress={handleLogout}
                  activeOpacity={0.7}
                >
                  <Text style={styles.logoutBtnText}>{t('logout')}</Text>
                </TouchableOpacity>

              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <LeaderboardModal
        visible={isLeaderboardVisible}
        onClose={() => setIsLeaderboardVisible(false)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  scrollContent: {
    padding: 24
  },
  headerAvatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.light,
  },
  headerAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  headerAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  modalAvatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    ...SHADOWS.medium,
  },
  modalAvatarText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
  },
  modalAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: -4,
    backgroundColor: '#FFFFFF',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.light,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  editAvatarText: {
    fontSize: 14,
    color: COLORS.primary,
  },
  welcomeSection: {
    marginBottom: 28,
    marginLeft: 4
  },
  welcomeSub: {
    fontSize: 15,
    color: COLORS.textSub,
    fontWeight: '500',
    marginBottom: 4
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.textMain,
    letterSpacing: -0.5
  },
  leaderboardBtn: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FEF08A',
    ...SHADOWS.light,
  },
  leaderboardBtnText: {
    color: '#CA8A04',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...SHADOWS.medium
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    color: COLORS.textMain,
    letterSpacing: 0.2
  },
  cardDescription: {
    fontSize: 13,
    color: COLORS.textSub,
    marginBottom: 20,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  inputFlex: {
    flex: 1
  },
  scanBtn: {
    marginLeft: 8,
    height: 56,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: COLORS.secondary,
  },
  scanBtnText: {
    fontSize: 12,
  },
  verifyBtn: {
    marginLeft: 8,
    height: 56,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  verifyBtnText: {
    fontSize: 13,
  },
  publishSpacing: {
    height: 10
  },
  sliderContainer: {
    flexDirection: 'row',
    backgroundColor: '#EAECEF',
    borderRadius: 14,
    padding: 4,
    marginBottom: 24
  },
  sliderBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10
  },
  sliderBtnActive: {
    backgroundColor: '#FFFFFF',
    ...SHADOWS.light
  },
  sliderText: {
    fontWeight: '700',
    color: COLORS.textSub,
    fontSize: 13
  },
  sliderTextActive: {
    color: COLORS.primary,
    fontWeight: '800'
  },
  imagePickerContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  addPhotoBtn: {
    width: '100%',
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoBtnText: {
    color: COLORS.textSub,
    fontSize: 14,
    fontWeight: '700',
  },
  previewContainer: {
    width: '100%',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 14,
    marginBottom: 12,
  },
  changePhotoBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  changePhotoText: {
    color: COLORS.textMain,
    fontSize: 13,
    fontWeight: '600',
  },
  // --- Active Offers Section ---
  myOffersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  refreshBtn: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '700',
  },
  emptyOffersBox: {
    paddingVertical: 24,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  emptyOffersText: {
    fontSize: 14,
    color: COLORS.textSub,
    fontWeight: '600',
  },
  myOfferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  myOfferTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 50,
    alignItems: 'center',
  },
  myOfferTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  myOfferStock: {
    fontSize: 12,
    color: COLORS.textSub,
    marginTop: 2,
  },
  myOfferDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  myOfferDeleteText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.danger,
  },
  // --- Settings Modal ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(31, 41, 51, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    ...SHADOWS.heavy,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
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
  profileInfoBox: {
    alignItems: 'center',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textMain,
    marginTop: 12,
  },
  profileRole: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 4,
    letterSpacing: 1,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSub,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  langContainer: {
    flexDirection: 'row',
    backgroundColor: '#F7F7F8',
    padding: 4,
    borderRadius: 12,
    marginBottom: 30,
  },
  langBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  langBtnActive: {
    backgroundColor: '#FFFFFF',
    ...SHADOWS.light
  },
  langText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSub
  },
  langTextActive: {
    color: COLORS.textMain
  },
  logoutBtn: {
    backgroundColor: '#FEF2F2',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  logoutBtnText: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  }
});

export default DashboardScreen;