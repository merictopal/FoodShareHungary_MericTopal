import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { useNavigation } from '@react-navigation/native';
// Import the API service to communicate with the Python backend
import { offersApi } from '../../api/offers';
import { apiErrorKey, verifySuccessMessage } from '../../utils/apiErrors';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/Button';
import { COLORS, SIZES, SPACING } from '../../constants/theme';

// 🚀 THE ABSOLUTE FIX: Module-level lock! 
// This lives outside of React's lifecycle and cannot be bypassed by 60FPS camera frames.
let isGlobalScanLocked = false;

export default function ScannerScreen() {
  // State management for camera permissions, scanning status, and API loading
  // 'pending' until the system dialog answers, so "denied" isn't flashed while asking
  const [permission, setPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [isScanned, setIsScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const navigation = useNavigation();
  const { t } = useAuth();
  const insets = useSafeAreaInsets();
  
  // Get the back camera of the device
  const device = useCameraDevice('back');

  useEffect(() => {
    // Reset the lock every time the scanner screen is opened
    isGlobalScanLocked = false;
    
    // Request native camera permissions on component mount
    (async () => {
      const status = await Camera.requestCameraPermission();
      setPermission(status === 'granted' ? 'granted' : 'denied');
    })();
  }, []);

  // Configure the high-performance QR code scanner
  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    // Use synchronous callback to lock the gate instantly
    onCodeScanned: (codes) => {
      // INSTANT BLOCK: If the gate is locked, reject all incoming 60FPS frames immediately
      if (isGlobalScanLocked) return; 

      if (codes.length > 0 && codes[0].value) {
        // 🔒 LOCK THE GATE! No other frame can pass this point.
        isGlobalScanLocked = true;
        
        setIsScanned(true);
        setLoading(true);
        
        const scannedData = codes[0].value;
        
        // Execute API call asynchronously without holding up the JS thread
        offersApi.verifyQr(scannedData)
          .then((res: any) => {
            // Instantly stop the loading spinner
            setLoading(false);
            
            // Extract the dynamic success message (XP and Points) from the backend
            const successMsg = verifySuccessMessage(res.data, t);
            
            // Wrap the Alert in a setTimeout for native UI stability
            setTimeout(() => {
              Alert.alert(t('success'), successMsg, [
                { 
                  text: t('ok'), 
                  onPress: () => {
                    // Navigate back. The lock remains TRUE so no rogue frames can trigger anything while closing.
                    navigation.goBack(); 
                  }
                }
              ]);
            }, 400); 
          })
          .catch((e: any) => {
            // Instantly stop the loading spinner if validation fails
            setLoading(false);
            
            const errorMsg = t(apiErrorKey(e, 'scanner_invalid_qr'));
            
            setTimeout(() => {
              Alert.alert(t('scanner_verify_failed'), errorMsg, [
                {
                  text: t('scanner_scan_again'),
                  onPress: () => {
                    // UNLOCK THE GATE only because the user explicitly wants to try again
                    isGlobalScanLocked = false;
                    setIsScanned(false);
                  }
                },
                {
                  text: t('cancel'),
                  style: 'cancel',
                  onPress: () => {
                    navigation.goBack();
                  }
                }
              ]);
            }, 400);
          });
      }
    }
  });

  // --- PERMISSION / DEVICE STATES ---
  if (permission === 'pending') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (permission === 'denied' || device == null) {
    const denied = permission === 'denied';

    return (
      <View style={[styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.stateIcon}>
          <Ionicons
            name={denied ? 'videocam-off-outline' : 'camera-outline'}
            size={30}
            color={COLORS.primary}
          />
        </View>

        {denied && (
          <Text style={styles.stateTitle}>{t('scanner_permission_title')}</Text>
        )}

        <Text style={styles.stateText}>
          {denied ? t('scanner_no_permission') : t('scanner_no_device')}
        </Text>

        {/* Settings is the only place a permanently denied camera permission can be granted again */}
        {denied && (
          <Button
            title={t('open_settings')}
            onPress={() => Linking.openSettings()}
            style={styles.stateButton}
            icon={<Ionicons name="settings-outline" size={18} color={COLORS.white} />}
          />
        )}

        <Button
          title={t('a11y_go_back')}
          onPress={() => navigation.goBack()}
          variant="outline"
          style={styles.stateButton}
          icon={<Ionicons name="arrow-back-outline" size={18} color={COLORS.primary} />}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        // Pause the camera feed while processing the API request
        isActive={!isScanned}
        codeScanner={codeScanner}
      />

      {/* FoodShare-styled overlay; purely visual, scanning is handled above */}
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={[styles.topBar, { paddingTop: insets.top + SPACING.sm }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y_go_back')}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.topTitle} numberOfLines={1}>{t('scan_qr_btn')}</Text>
          <View style={styles.backButtonPlaceholder} />
        </View>

        <View style={styles.middle}>
          <Text style={styles.hint}>{t('scanner_hint')}</Text>
          <View style={styles.scanArea} />

          {/* Show a loading spinner while waiting for the backend response */}
          {loading && (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>{t('scanner_verifying')}</Text>
            </View>
          )}
        </View>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + SPACING.xxl }]}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>{t('cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Permission / no-device state (cream background, as on the other screens)
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    backgroundColor: COLORS.background,
  },
  stateIcon: {
    width: 72,
    height: 72,
    borderRadius: SIZES.radiusFull,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  stateTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textMain,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  stateText: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textSub,
    textAlign: 'center',
    marginBottom: SPACING.xxl,
  },
  stateButton: {
    width: '100%',
    marginBottom: SPACING.md,
  },

  // Camera overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: SIZES.radiusFull,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPlaceholder: {
    width: 42,
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '800',
    marginHorizontal: SPACING.sm,
  },
  middle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.xxl,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  scanArea: {
    width: 260,
    height: 260,
    borderWidth: 3,
    borderColor: COLORS.white,
    backgroundColor: 'transparent',
    borderRadius: SIZES.radiusLg,
  },
  loadingBox: {
    position: 'absolute',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.xxl,
    borderRadius: SIZES.radiusMd,
  },
  loadingText: {
    color: COLORS.textMain,
    marginTop: SPACING.md,
    fontWeight: '700',
  },
  bottomBar: {
    alignItems: 'center',
    paddingTop: SPACING.lg,
  },
  cancelButton: {
    minWidth: 160,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.xxxl,
    paddingVertical: 14,
    borderRadius: SIZES.radiusMd,
  },
  cancelText: {
    color: COLORS.textMain,
    fontWeight: '800',
    fontSize: 15,
  },
});
