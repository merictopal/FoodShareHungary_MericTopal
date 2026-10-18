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
  ActivityIndicator,
  PermissionsAndroid
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import { offersApi } from '../../api/offers';
import { client } from '../../api/client';
import { COLORS, SIZES, SHADOWS } from '../../constants/theme';
import { Header } from '../../components/Header';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { LeaderboardModal } from '../../components/LeaderboardModal';
import { OfferTypeBadge } from '../../components/OfferTypeBadge';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { toLangUpper } from '../../utils/text';
import { launchCamera, launchImageLibrary, Asset } from 'react-native-image-picker';
import { apiErrorKey, verifySuccessMessage } from '../../utils/apiErrors';

const DashboardScreen = () => {
  const { user, logout, t, changeLanguage, lang, updateUser } = useAuth();
  const navigation = useNavigation<any>();

  const [activeTab, setActiveTab] = useState<'free' | 'discount'>('free');
  const [qrCode, setQrCode] = useState('');
  // Inline field errors as translation keys (translated at render, so a language switch updates them)
  const [qrError, setQrError] = useState('');
  const [titleError, setTitleError] = useState('');
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

  // Restaurant location (lat/lng stored on the backend; the PostGIS point is derived from them)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);

  // Accept a response as a location only if both coordinates are finite numbers: the location card
  // calls toFixed on them, so a 2xx body without numeric lat/lng must leave the state null instead.
  const toLocation = (data: any): { lat: number; lng: number } | null =>
    Number.isFinite(data?.lat) && Number.isFinite(data?.lng) ? { lat: data.lat, lng: data.lng } : null;

  const fetchLocation = async () => {
    try {
      const res = await client.get('/restaurant/location');
      const loc = toLocation(res.data);
      if (!loc) console.warn('fetchLocation: response without numeric lat/lng');
      setLocation(loc);
    } catch (e) {
      console.warn('fetchLocation failed:', e);
    }
  };

  // Saves the device's current GPS position as the restaurant location
  const handleUseCurrentLocation = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert(t('error'), t('location_permission_required'));
        return;
      }
    }
    setSavingLocation(true);
    Geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await client.put('/restaurant/location', { lat: latitude, lng: longitude });
          const loc = toLocation(res.data);
          if (!loc) {
            Alert.alert(t('error'), t('location_save_failed'));
            return;
          }
          setLocation(loc);
          Alert.alert(t('success'), t('location_updated'));
        } catch (e: any) {
          Alert.alert(t('error'), t(apiErrorKey(e, 'location_save_failed')));
        } finally {
          setSavingLocation(false);
        }
      },
      () => {
        setSavingLocation(false);
        Alert.alert(t('error'), t('location_read_failed'));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Refresh the offers list every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchMyOffers();
      fetchLocation();
    }, [user?.id])
  );

  const handleDeleteOffer = async (offerId: number) => {
    Alert.alert(
      t('delete_offer'),
      t('confirm_delete_offer'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await offersApi.deleteOffer(offerId, user!.id);
              // Optimistically remove from local state without a full refetch
              setMyOffers(prev => prev.filter(o => o.id !== offerId));
            } catch (e) {
              Alert.alert(t('error'), t('offer_delete_failed'));
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
            launchCamera({ mediaType: 'photo', quality: 0.8, maxWidth: 1280, maxHeight: 1280 }, (response) => {
              if (response.assets && response.assets.length > 0) {
                setPhoto(response.assets[0]);
              }
            });
          }
        },
        {
          text: t('gallery') || 'Choose from Gallery',
          onPress: () => {
            launchImageLibrary({ mediaType: 'photo', quality: 0.8, maxWidth: 1280, maxHeight: 1280 }, (response) => {
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
          launchCamera({ mediaType: 'photo', quality: 0.5, maxWidth: 512, maxHeight: 512 }, (res) => {
            if (res.assets?.length) uploadAvatar(res.assets[0]);
          });
        }
      },
      {
        text: t('gallery') || 'Gallery',
        onPress: () => {
          launchImageLibrary({ mediaType: 'photo', quality: 0.5, maxWidth: 512, maxHeight: 512 }, (res) => {
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
        Alert.alert(t('success'), t('avatar_updated'));
      }
    } catch (error) {
      Alert.alert(t('error'), t('avatar_upload_failed'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleVerify = async () => {
    if (!qrCode.trim()) {
      setQrError('invalid_code');
      return;
    }
    setQrError('');

    setLoading(true);
    Keyboard.dismiss();

    try {
      const res = await offersApi.verifyQr(qrCode.trim());
      // The backend reports the actual XP/points (e.g. "+50 XP … +20 Points"); same as the scanner screen
      Alert.alert(t('success'), verifySuccessMessage(res.data, t));
      setQrCode('');
    } catch (e: any) {
      Alert.alert(t('error'), t(apiErrorKey(e, 'generic_error')));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      setTitleError('field_required');
      return;
    }
    setTitleError('');

    // Same rules as the backend (quantity >= 1, discount 0-100), checked here so the user gets a translated message
    const parsedQty = parseInt(qty, 10);
    if (qty.trim() !== '' && !(parsedQty >= 1)) {
      Alert.alert(t('error'), t('err_check_input'));
      return;
    }
    const parsedDiscount = parseInt(discount, 10);
    if (activeTab === 'discount' && discount.trim() !== '' && !(parsedDiscount >= 0 && parsedDiscount <= 100)) {
      Alert.alert(t('error'), t('discount_range'));
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

      // A failed photo upload after the offer was created still counts as published (no retry/duplicate)
      let photoUploadFailed = false;
      if (photo) {
        const result = await offersApi.createWithImage(offerData, photo);
        photoUploadFailed = Boolean((result as any).photoUploadFailed);
      } else {
        await offersApi.create(offerData);
      }

      Alert.alert(
        t('success'),
        t(photoUploadFailed ? 'msg_offer_published_photo_failed' : 'msg_offer_published')
      );

      // Reset the form fields
      setTitle('');
      setQty('1');
      setDiscount('');
      setActiveTab('free');
      setPhoto(null);

      // Immediately refresh the active offers list after a successful publish
      fetchMyOffers();

    } catch (e: any) {
      Alert.alert(t('error'), t(apiErrorKey(e, 'generic_error')));
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
            <Ionicons name="pencil" size={14} color={COLORS.primary} />
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
            <Ionicons name="trophy-outline" size={14} color="#B7791F" />
            <Text style={styles.leaderboardBtnText}>{t('leaderboard')}</Text>
          </TouchableOpacity>
        </View>

        {/* QR Verification Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('verify_qr')}</Text>
          <Text style={styles.cardDescription}>{t('desc_verify_qr')}</Text>

          <Button
            title={t('scan_qr_btn')}
            onPress={() => navigation.navigate('Scanner')}
            icon={<Ionicons name="scan-outline" size={20} color={COLORS.white} />}
          />

          <View style={styles.manualEntryRow}>
            <View style={styles.inputFlex}>
              <Input
                placeholder={t('qr_ph')}
                value={qrCode}
                onChangeText={(text) => {
                  setQrCode(text);
                  if (qrError) setQrError('');
                }}
                autoCapitalize="characters"
                error={qrError ? t(qrError) : undefined}
                style={styles.manualEntryInput}
              />
            </View>
            <Button
              title={t('verify_btn')}
              onPress={handleVerify}
              loading={loading}
              variant="outline"
              style={styles.verifyBtn}
              textStyle={styles.verifyBtnText}
            />
          </View>
        </View>

        {/* Restaurant Location Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('restaurant_location_title')}</Text>
          <Text style={styles.cardDescription}>{t('location_card_desc')}</Text>

          <View style={styles.locationRow}>
            <View style={styles.locationIcon}>
              <Ionicons name="location-outline" size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.locationText}>
              {location
                ? `Lat ${location.lat.toFixed(5)}, Lng ${location.lng.toFixed(5)}`
                : t('location_not_loaded')}
            </Text>
          </View>

          <Button
            title={t('use_current_location')}
            onPress={handleUseCurrentLocation}
            loading={savingLocation}
            variant="outline"
            icon={<Ionicons name="locate-outline" size={18} color={COLORS.primary} />}
          />
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
            onChangeText={(text) => {
              setTitle(text);
              if (titleError) setTitleError('');
            }}
            placeholder={t('ph_offer_name')}
            error={titleError ? t(titleError) : undefined}
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
                <Ionicons name="camera-outline" size={18} color={COLORS.textSub} />
                <Text style={styles.addPhotoBtnText}>{t('add_photo')}</Text>
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
            <Text style={styles.cardTitle}>{t('my_offers')}</Text>
            <TouchableOpacity onPress={fetchMyOffers} activeOpacity={0.7}>
              <Text style={styles.refreshBtn}>{t('refresh')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.cardDescription}>
            {t('desc_my_offers')}
          </Text>

          {loadingOffers ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
          ) : myOffers.length === 0 ? (
            <View style={styles.emptyOffersBox}>
              <Text style={styles.emptyOffersText}>
                {t('no_active_offers')}
              </Text>
            </View>
          ) : (
            myOffers.map(offer => (
              <View key={offer.id} style={styles.myOfferRow}>
                <View style={styles.myOfferInfo}>
                  <Text style={styles.myOfferTitle} numberOfLines={1}>{offer.title}</Text>
                  <View style={styles.myOfferMetaRow}>
                    <OfferTypeBadge type={offer.type} discountRate={offer.discount_rate} />
                    <View style={styles.myOfferStockRow}>
                      <Ionicons name="flame-outline" size={13} color={COLORS.textMuted} />
                      <Text style={styles.myOfferStock}>
                        {offer.quantity_left} {t('left')}
                      </Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => handleDeleteOffer(offer.id)}
                  style={styles.myOfferDeleteBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={t('delete_offer')}
                >
                  <Ionicons name="close" size={16} color={COLORS.danger} />
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
                  <Text style={styles.profileRole}>{toLangUpper(t('role_rest'), lang)}</Text>
                </View>

                <Text style={styles.sectionLabel}>{toLangUpper(t('lang_change'), lang)}</Text>
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

  // =====================================================
  // SCREEN
  // =====================================================

  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },

  // =====================================================
  // HEADER / AVATAR
  // =====================================================

  headerAvatarContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,

    backgroundColor: COLORS.primary,

    justifyContent: 'center',
    alignItems: 'center',

    overflow: 'hidden',

    ...SHADOWS.light,
  },

  headerAvatarText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
  },

  headerAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 19,
  },

  // =====================================================
  // WELCOME
  // =====================================================

  welcomeSection: {
    marginBottom: 24,
    marginHorizontal: 2,
  },

  welcomeSub: {
    fontSize: 13,
    color: COLORS.textSub,
    fontWeight: '500',
    marginBottom: 3,
  },

  welcomeTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textMain,
    letterSpacing: -0.5,
  },

  leaderboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',

    backgroundColor: '#FFFBEB',

    paddingHorizontal: 13,
    paddingVertical: 9,

    borderRadius: SIZES.radiusFull,

    borderWidth: 1,
    borderColor: '#FDE68A',

    ...SHADOWS.light,
  },

  leaderboardBtnText: {
    marginLeft: 5,
    color: '#B7791F',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  // =====================================================
  // GENERAL CARDS
  // =====================================================

  card: {
    backgroundColor: COLORS.surface,

    borderRadius: SIZES.radiusLg,

    padding: 20,

    marginBottom: 16,

    borderWidth: 1,
    borderColor: COLORS.border,

    ...SHADOWS.light,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: '800',

    color: COLORS.textMain,

    marginBottom: 6,

    letterSpacing: -0.2,
  },

  cardDescription: {
    fontSize: 13,

    color: COLORS.textSub,

    lineHeight: 19,

    marginBottom: 18,
  },

  // =====================================================
  // ROWS / INPUT AREAS
  // =====================================================

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  inputFlex: {
    flex: 1,
    minWidth: 0,
  },

  manualEntryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
  },

  manualEntryInput: {
    marginBottom: 0,
  },

  verifyBtn: {
    height: 54,

    marginLeft: 8,

    paddingHorizontal: 16,

    borderRadius: SIZES.radiusMd,
  },

  verifyBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',

    padding: 12,
    marginBottom: 16,

    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  locationIcon: {
    width: 34,
    height: 34,

    marginRight: 10,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.primaryLight,
    borderRadius: SIZES.radiusFull,
  },

  locationText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMain,
  },

  publishSpacing: {
    height: 4,
  },

  // =====================================================
  // FREE / DISCOUNT SELECTOR
  // =====================================================

  sliderContainer: {
    flexDirection: 'row',

    backgroundColor: COLORS.surfaceMuted,

    borderRadius: SIZES.radius,

    padding: 4,

    marginBottom: 20,

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  sliderBtn: {
    flex: 1,

    alignItems: 'center',
    justifyContent: 'center',

    paddingVertical: 11,

    borderRadius: SIZES.radiusSm,
  },

  sliderBtnActive: {
    backgroundColor: COLORS.surface,

    ...SHADOWS.light,
  },

  sliderText: {
    fontSize: 13,

    fontWeight: '600',

    color: COLORS.textMuted,
  },

  sliderTextActive: {
    color: COLORS.primary,

    fontWeight: '800',
  },

  // =====================================================
  // PHOTO PICKER
  // =====================================================

  imagePickerContainer: {
    marginBottom: 18,

    alignItems: 'center',
  },

  addPhotoBtn: {
    width: '100%',

    flexDirection: 'row',
    gap: 8,

    minHeight: 64,

    paddingHorizontal: 16,

    borderWidth: 1.5,
    borderColor: COLORS.borderStrong,

    borderStyle: 'dashed',

    borderRadius: SIZES.radius,

    backgroundColor: COLORS.surfaceSecondary,

    alignItems: 'center',
    justifyContent: 'center',
  },

  addPhotoBtnText: {
    color: COLORS.textSub,

    fontSize: 13,

    fontWeight: '700',
  },

  previewContainer: {
    width: '100%',

    alignItems: 'center',
  },

  previewImage: {
    width: '100%',

    height: 180,

    borderRadius: SIZES.radiusMd,

    marginBottom: 10,
  },

  changePhotoBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,

    backgroundColor: COLORS.surfaceMuted,

    borderRadius: SIZES.radiusSm,

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  changePhotoText: {
    color: COLORS.textMain,

    fontSize: 12,

    fontWeight: '700',
  },

  // =====================================================
  // ACTIVE OFFERS
  // =====================================================

  myOffersHeader: {
    flexDirection: 'row',

    justifyContent: 'space-between',
    alignItems: 'center',

    marginBottom: 6,
  },

  refreshBtn: {
    fontSize: 12,

    color: COLORS.primary,

    fontWeight: '800',
  },

  emptyOffersBox: {
    paddingVertical: 22,

    paddingHorizontal: 16,

    alignItems: 'center',

    backgroundColor: COLORS.surfaceSecondary,

    borderRadius: SIZES.radius,

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  emptyOffersText: {
    fontSize: 13,

    color: COLORS.textSub,

    fontWeight: '500',

    textAlign: 'center',
  },

  myOfferRow: {
    flexDirection: 'row',

    alignItems: 'center',

    minHeight: 68,

    paddingVertical: 12,

    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },

  myOfferInfo: {
    flex: 1,
    marginRight: 12,
  },

  myOfferMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 10,
    rowGap: 4,
    marginTop: 6,
  },

  myOfferTitle: {
    fontSize: 14,

    fontWeight: '700',

    color: COLORS.textMain,
  },

  myOfferStockRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  myOfferStock: {
    fontSize: 11,

    color: COLORS.textMuted,

    marginLeft: 4,

    fontWeight: '600',
  },

  myOfferDeleteBtn: {
    width: 32,
    height: 32,

    borderRadius: SIZES.radiusFull,

    backgroundColor: COLORS.dangerLight,

    justifyContent: 'center',
    alignItems: 'center',

    borderWidth: 1,
    borderColor: '#F6C9C4',
  },

  // =====================================================
  // SETTINGS MODAL
  // =====================================================

  modalOverlay: {
    flex: 1,

    backgroundColor: COLORS.overlay,

    justifyContent: 'center',
    alignItems: 'center',

    padding: 20,
  },

  modalContent: {
    width: '100%',

    maxWidth: 420,

    backgroundColor: COLORS.surface,

    borderRadius: SIZES.radiusXl,

    padding: 24,

    ...SHADOWS.heavy,
  },

  modalHeader: {
    flexDirection: 'row',

    justifyContent: 'space-between',
    alignItems: 'center',

    marginBottom: 20,
  },

  modalTitle: {
    fontSize: 21,

    fontWeight: '800',

    color: COLORS.textMain,

    letterSpacing: -0.3,
  },

  closeBtn: {
    width: 34,
    height: 34,

    borderRadius: SIZES.radiusFull,

    backgroundColor: COLORS.surfaceMuted,

    justifyContent: 'center',
    alignItems: 'center',
  },

  closeBtnText: {
    fontSize: 15,

    fontWeight: '800',

    color: COLORS.textSub,
  },

  // =====================================================
  // MODAL PROFILE
  // =====================================================

  profileInfoBox: {
    alignItems: 'center',

    paddingBottom: 20,

    marginBottom: 22,

    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },

  modalAvatarContainer: {
    width: 76,
    height: 76,

    borderRadius: SIZES.radiusFull,

    backgroundColor: COLORS.primary,

    justifyContent: 'center',
    alignItems: 'center',

    marginBottom: 10,

    overflow: 'hidden',

    ...SHADOWS.medium,
  },

  modalAvatarText: {
    color: COLORS.white,

    fontSize: 30,

    fontWeight: '800',
  },

  modalAvatarImage: {
    width: '100%',
    height: '100%',

    borderRadius: SIZES.radiusFull,
  },

  editAvatarBtn: {
    position: 'absolute',

    bottom: 0,
    right: -2,

    width: 28,
    height: 28,

    borderRadius: SIZES.radiusFull,

    backgroundColor: COLORS.surface,

    justifyContent: 'center',
    alignItems: 'center',

    borderWidth: 1,
    borderColor: COLORS.border,

    ...SHADOWS.light,
  },

  profileName: {
    fontSize: 21,

    fontWeight: '800',

    color: COLORS.textMain,

    marginTop: 4,
  },

  profileRole: {
    fontSize: 11,

    fontWeight: '800',

    color: COLORS.primary,

    marginTop: 4,

    letterSpacing: 0.8,
  },

  // =====================================================
  // LANGUAGE
  // =====================================================

  sectionLabel: {
    fontSize: 11,

    fontWeight: '800',

    color: COLORS.textMuted,

    marginBottom: 10,

    letterSpacing: 0.6,
  },

  langContainer: {
    flexDirection: 'row',

    backgroundColor: COLORS.surfaceMuted,

    padding: 4,

    borderRadius: SIZES.radius,

    marginBottom: 24,

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  langBtn: {
    flex: 1,

    paddingVertical: 10,

    alignItems: 'center',

    borderRadius: SIZES.radiusSm,
  },

  langBtnActive: {
    backgroundColor: COLORS.surface,

    ...SHADOWS.light,
  },

  langText: {
    fontSize: 12,

    fontWeight: '700',

    color: COLORS.textMuted,
  },

  langTextActive: {
    color: COLORS.primary,

    fontWeight: '800',
  },

  // =====================================================
  // LOGOUT
  // =====================================================

  logoutBtn: {
    backgroundColor: COLORS.dangerLight,

    paddingVertical: 14,

    borderRadius: SIZES.radius,

    alignItems: 'center',

    borderWidth: 1,
    borderColor: '#F6C9C4',
  },

  logoutBtnText: {
    color: COLORS.danger,

    fontSize: 14,

    fontWeight: '800',

    letterSpacing: 0.4,
  },
});

export default DashboardScreen;