import React, { useState } from 'react';
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
  Keyboard
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { offersApi } from '../../api/offers';
import { COLORS, SHADOWS } from '../../constants/theme';
import { Header } from '../../components/Header';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';

// --- MAIN COMPONENT ---
const DashboardScreen = () => {
  // --- CONTEXT & HOOKS ---
  const { user, logout, t, changeLanguage, lang } = useAuth();
  
  // --- STATE MANAGEMENT ---
  const [activeTab, setActiveTab] = useState<'free' | 'discount'>('free');
  const [qrCode, setQrCode] = useState('');
  const [title, setTitle] = useState('');
  const [qty, setQty] = useState('1');
  const [discount, setDiscount] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);

  // --- ACTIONS: QR VERIFICATION ---
  const handleVerify = async () => {
    // Prevent empty submissions
    if (!qrCode.trim()) {
      Alert.alert(t('error'), 'Invalid code.'); // Simple fallback if not translated
      return;
    }
    
    setLoading(true);
    Keyboard.dismiss();
    
    try {
      const res = await offersApi.verifyQr(qrCode.trim());
      // Replaced hardcoded "Puan" with translated text
      Alert.alert(t('success'), `+${res.points || 10} ${t('saved')}!`);
      setQrCode('');
    } catch (e: any) {
      const errorMsg = e.response?.data?.message || t('error');
      Alert.alert(t('error'), errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // --- ACTIONS: CREATE OFFER ---
  const handleCreate = async () => {
    // Prevent empty title submissions
    if (!title.trim()) {
      Alert.alert(t('error'), 'Missing information.'); 
      return;
    }

    setLoading(true);
    Keyboard.dismiss();
    
    try {
      const quantityNum = parseInt(qty) || 1; 
      const discountValue = activeTab === 'free' ? 0 : (parseInt(discount) || 0);

      await offersApi.create({
        user_id: user?.id,
        title: title.trim(),
        description: title.trim(),
        type: activeTab,
        quantity: quantityNum,
        discount_rate: discountValue
      });
      
      Alert.alert(t('success'), t('msg_offer_published'));
      
      // Reset Form fields after successful creation
      setTitle(''); 
      setQty('1'); 
      setDiscount('');
      setActiveTab('free');
      
    } catch (e: any) {
      console.error("Offer Creation Error:", e.response?.data);
      const errorMsg = e.response?.data?.message || t('error');
      Alert.alert(t('error'), errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // --- ACTIONS: LOGOUT CONFIRMATION ---
  const handleLogout = () => {
    setIsSettingsVisible(false);
    Alert.alert(
      t('logout'), 
      t('logout_confirm_msg'), 
      [
        { text: t('cancel'), style: "cancel" },
        { text: t('logout'), style: "destructive", onPress: logout }
      ]
    );
  };

  // --- UI COMPONENTS: AVATAR ---
  // Generates a sleek, circular avatar based on the restaurant's first letter
  const renderAvatar = () => {
    const initial = user?.name ? user.name.charAt(0).toUpperCase() : 'R';
    return (
      <View style={styles.avatarContainer}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
    );
  };

  // --- RENDER ---
  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* HEADER
        Passes the renderAvatar function to display the profile circle.
        Pressing it opens the new Settings Modal.
      */}
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
        
        {/* --- WELCOME SECTION --- */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeSub}>{t('hello')},</Text>
          <Text style={styles.welcomeTitle}>{user?.name}</Text>
        </View>

        {/* --- QR VERIFICATION CARD --- */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('verify_qr')}</Text>
          {/* Dynamic translated description */}
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
              title={t('verify_btn')} 
              onPress={handleVerify} 
              loading={loading} 
              style={styles.verifyBtn} 
              textStyle={styles.verifyBtnText}
            />
          </View>
        </View>

        {/* --- CREATE OFFER CARD --- */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('add_offer')}</Text>
          {/* Dynamic translated description */}
          <Text style={styles.cardDescription}>{t('desc_add_offer')}</Text>

          {/* Tab Slider (Free / Discount) */}
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

          {/* Form Inputs (Placeholders replaced with translations) */}
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
          
          <Button 
            title={t('publish')} 
            onPress={handleCreate} 
            loading={loading}
          />
        </View>
        
        {/* Bottom Padding for scroll area */}
        <View style={{ height: 40 }} />

      </ScrollView>

      {/* --- SETTINGS & PROFILE MODAL --- */}
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
                
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{t('nav_profile')}</Text>
                  <TouchableOpacity 
                    onPress={() => setIsSettingsVisible(false)}
                    style={styles.closeBtn}
                    hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                  >
                    <Text style={styles.closeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Profile Info */}
                <View style={styles.profileInfoBox}>
                  {renderAvatar()}
                  <Text style={styles.profileName}>{user?.name}</Text>
                  <Text style={styles.profileRole}>{t('role_rest')}</Text>
                </View>

                {/* Language Switcher */}
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

                {/* Logout Button */}
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

    </KeyboardAvoidingView>
  );
};

// --- STYLES ---
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background 
  },
  scrollContent: { 
    padding: 24 
  },
  
  // Header Avatar
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.light,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  // Welcome Section
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

  // Card Styles
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
  
  // Form Elements
  row: { 
    flexDirection: 'row', 
    alignItems: 'flex-start' 
  },
  inputFlex: { 
    flex: 1 
  },
  verifyBtn: { 
    marginLeft: 12,
    height: 56, // Matches the Input component height perfectly
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  verifyBtnText: {
    fontSize: 14,
  },
  publishSpacing: {
    height: 10
  },

  // Slider (Free / Discount)
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

  // --- MODAL STYLES ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(31, 41, 51, 0.4)', // Uses theme overlay logic
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
  
  // Modal Profile Section
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

  // Modal Settings Section
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

  // Modal Logout Button
  logoutBtn: {
    backgroundColor: '#FEF2F2', // Very soft red for warning
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