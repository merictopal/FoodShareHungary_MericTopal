import React, { ReactNode } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, SIZES, SPACING, SHADOWS } from '../constants/theme';
import { useAuth } from '../context/AuthContext';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  // Kept configurable so migrated modals keep their previous animation
  animationType?: 'slide' | 'fade';
  contentStyle?: ViewStyle;
}

// Shared bottom sheet: dimmed overlay (tap to close), white rounded sheet, optional title row
// with a labelled close icon, and safe-area padding at the bottom.
export const BottomSheet = ({
  visible,
  onClose,
  title,
  children,
  animationType = 'slide',
  contentStyle,
}: BottomSheetProps) => {
  const { t } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={animationType}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View
              style={[
                styles.sheet,
                { paddingBottom: SPACING.xxxl + insets.bottom },
                contentStyle,
              ]}
            >
              <View style={styles.handle} />

              {title !== undefined && (
                <View style={styles.header}>
                  <Text style={styles.title} accessibilityRole="header">
                    {title}
                  </Text>

                  <TouchableOpacity
                    onPress={onClose}
                    style={styles.closeButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel={t('close_btn')}
                  >
                    <Ionicons name="close" size={20} color={COLORS.textSub} />
                  </TouchableOpacity>
                </View>
              )}

              {children}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },

  sheet: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxxl,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: SIZES.radiusXl,
    borderTopRightRadius: SIZES.radiusXl,
    ...SHADOWS.heavy,
  },

  handle: {
    width: 42,
    height: 4,
    borderRadius: SIZES.radiusFull,
    backgroundColor: COLORS.borderStrong,
    marginBottom: SPACING.lg,
  },

  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xxl,
  },

  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textMain,
    letterSpacing: -0.3,
    marginRight: SPACING.md,
  },

  closeButton: {
    width: 36,
    height: 36,
    borderRadius: SIZES.radiusFull,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default BottomSheet;
