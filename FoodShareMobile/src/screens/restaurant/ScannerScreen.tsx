import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { useNavigation } from '@react-navigation/native';
// Import the API service to communicate with the Python backend
import { offersApi } from '../../api/offers';

// 🚀 THE ABSOLUTE FIX: Module-level lock! 
// This lives outside of React's lifecycle and cannot be bypassed by 60FPS camera frames.
let isGlobalScanLocked = false;

export default function ScannerScreen() {
  // State management for camera permissions, scanning status, and API loading
  const [hasPermission, setHasPermission] = useState(false);
  const [isScanned, setIsScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const navigation = useNavigation();
  
  // Get the back camera of the device
  const device = useCameraDevice('back');

  useEffect(() => {
    // Reset the lock every time the scanner screen is opened
    isGlobalScanLocked = false;
    
    // Request native camera permissions on component mount
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
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
            const successMsg = res.data?.message || res.message || 'Validation Successful!';
            
            // Wrap the Alert in a setTimeout for native UI stability
            setTimeout(() => {
              Alert.alert('Success!', successMsg, [
                { 
                  text: 'OK', 
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
            
            const errorMsg = e.response?.data?.message || 'Invalid or expired QR Code.';
            
            setTimeout(() => {
              Alert.alert('Verification Failed', errorMsg, [
                {
                  text: 'Scan Again',
                  onPress: () => {
                    // UNLOCK THE GATE only because the user explicitly wants to try again
                    isGlobalScanLocked = false;
                    setIsScanned(false);
                  }
                },
                {
                  text: 'Cancel',
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

  // Handle loading and permission UI states
  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text>No camera permission granted.</Text>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.center}>
        <Text>No camera device found on this emulator/phone.</Text>
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
      
      {/* Custom UI overlay for the scanner interface */}
      <View style={styles.overlay}>
        <View style={styles.scanArea} />
        
        {/* Show a loading spinner while waiting for the backend response */}
        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#00FF00" />
            <Text style={styles.loadingText}>Verifying with server...</Text>
          </View>
        )}

        <TouchableOpacity 
          style={styles.cancelButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Stylesheet for the scanner UI
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 260,
    height: 260,
    borderWidth: 3,
    borderColor: '#00FF00',
    backgroundColor: 'transparent',
    borderRadius: 12,
  },
  loadingBox: {
    position: 'absolute',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 20,
    borderRadius: 10,
  },
  loadingText: {
    color: '#00FF00',
    marginTop: 10,
    fontWeight: 'bold',
  },
  cancelButton: {
    position: 'absolute',
    bottom: 50,
    backgroundColor: '#FF3B30',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
  },
  cancelText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  }
});