import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { useNavigation } from '@react-navigation/native';
// Import the API service to communicate with the Python backend
import { offersApi } from '../../api/offers';

export default function ScannerScreen() {
  // State management for camera permissions, scanning status, and API loading
  const [hasPermission, setHasPermission] = useState(false);
  const [isScanned, setIsScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const navigation = useNavigation();
  
  // Get the back camera of the device
  const device = useCameraDevice('back');

  useEffect(() => {
    // Request native camera permissions on component mount
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
    })();
  }, []);

  // Configure the high-performance QR code scanner
  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: async (codes) => {
      // Prevent multiple rapid backend requests from a single scan
      if (isScanned || loading) return; 

      if (codes.length > 0 && codes[0].value) {
        setIsScanned(true);
        setLoading(true);
        
        const scannedData = codes[0].value;
        
        try {
          // Send the scanned unique QR code to the backend for validation
        // Explicitly define response as 'any' to bypass strict TypeScript checks
        const res: any = await offersApi.verifyQr(scannedData);          
          // Display success message with gamification points earned
          Alert.alert('Validation Successful!', `+${res.points || 10} Points added to your leaderboard!`, [
            { 
              text: 'OK', 
              onPress: () => {
                setLoading(false);
                navigation.goBack(); 
              }
            }
          ]);
        } catch (e: any) {
          // Handle expired, invalid, or already used QR codes
          const errorMsg = e.response?.data?.message || 'Invalid or expired QR Code.';
          Alert.alert('Verification Failed', errorMsg, [
            {
              text: 'Scan Again',
              onPress: () => {
                // Reset states to allow scanning another code
                setIsScanned(false);
                setLoading(false);
              }
            },
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                setLoading(false);
                navigation.goBack();
              }
            }
          ]);
        }
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