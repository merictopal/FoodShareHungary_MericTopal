import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { Button } from '../../../../components/Button';
import { PickupLocation } from '../../../../components/PickupLocation';
import type { RestaurantGroup } from '../utils';
import {
  COLORS,
  SIZES,
  SPACING,
  SHADOWS,
  TYPOGRAPHY,
} from '../../../../constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  qrCode: string | null;
  // Restaurant of the claimed offer (null if it could not be resolved)
  pickup?: RestaurantGroup | null;
  t: any;
}

export const SuccessQrModal: React.FC<Props> = ({
  visible,
  onClose,
  qrCode,
  pickup,
  t,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>

          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.card}>

              {/* ---------------------------------------- */}
              {/* SUCCESS ICON                            */}
              {/* ---------------------------------------- */}

              <View style={styles.successCircle}>
                <Ionicons
                  name="checkmark"
                  size={30}
                  color={COLORS.success}
                />
              </View>

              {/* ---------------------------------------- */}
              {/* TITLE                                   */}
              {/* ---------------------------------------- */}

              <Text style={styles.title}>
                {t('success')}!
              </Text>

              <Text style={styles.description}>
                {t('order_created')}
              </Text>

              {/* ---------------------------------------- */}
              {/* QR CODE                                 */}
              {/* ---------------------------------------- */}

              <View style={styles.qrWrapper}>
                {qrCode && (
                  <QRCode
                    value={qrCode}
                    size={190}
                    color={COLORS.textMain}
                    backgroundColor={COLORS.white}
                  />
                )}
              </View>

              {/* ---------------------------------------- */}
              {/* INFO                                    */}
              {/* ---------------------------------------- */}

              <View style={styles.infoBox}>
                <Ionicons
                  name="information-circle-outline"
                  size={17}
                  color={COLORS.info}
                />

                <Text style={styles.infoText}>
                  {t('qr_show_at_restaurant')}
                </Text>
              </View>

              {pickup && (
                <PickupLocation
                  name={pickup.name}
                  address={pickup.address}
                  lat={pickup.lat}
                  lng={pickup.lng}
                  t={t}
                  style={styles.pickup}
                />
              )}

              {/* ---------------------------------------- */}
              {/* CLOSE                                   */}
              {/* ---------------------------------------- */}

              <Button
                title={t('close_btn')}
                onPress={onClose}
                style={styles.closeButton}
                textStyle={styles.closeText}
                variant="primary"
              />

            </View>
          </TouchableWithoutFeedback>

        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  pickup: {
    marginBottom: SPACING.lg,
  },

  // ----------------------------------------------------
  // OVERLAY
  // ----------------------------------------------------

  overlay: {
    flex: 1,

    justifyContent: 'flex-end',

    backgroundColor: COLORS.overlay,
  },

  // ----------------------------------------------------
  // CARD
  // ----------------------------------------------------

  card: {
    width: '100%',

    alignItems: 'center',

    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.xxxl,

    backgroundColor: COLORS.surface,

    borderTopLeftRadius: SIZES.radiusXl,
    borderTopRightRadius: SIZES.radiusXl,

    ...SHADOWS.heavy,
  },

  // ----------------------------------------------------
  // SUCCESS
  // ----------------------------------------------------

  successCircle: {
    width: 58,
    height: 58,

    borderRadius: SIZES.radiusFull,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.successLight,

    marginBottom: SPACING.md,
  },

  // ----------------------------------------------------
  // TEXT
  // ----------------------------------------------------

  title: {
    color: COLORS.textMain,

    ...TYPOGRAPHY.title,

    marginBottom: SPACING.sm,

    textAlign: 'center',
  },

  description: {
    maxWidth: 310,

    color: COLORS.textSub,

    ...TYPOGRAPHY.body,

    lineHeight: 21,

    textAlign: 'center',

    marginBottom: SPACING.xxl,
  },

  // ----------------------------------------------------
  // QR
  // ----------------------------------------------------

  qrWrapper: {
    width: 230,
    height: 230,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.white,

    borderRadius: SIZES.radiusLg,

    borderWidth: 1,
    borderColor: COLORS.border,

    marginBottom: SPACING.lg,

    ...SHADOWS.light,
  },

  // ----------------------------------------------------
  // INFO
  // ----------------------------------------------------

  infoBox: {
    width: '100%',

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,

    marginBottom: SPACING.xxl,

    borderRadius: SIZES.radius,

    backgroundColor: COLORS.infoLight,
  },

  infoText: {
    flex: 1,

    marginLeft: SPACING.sm,

    color: COLORS.info,

    fontSize: 12,
    fontWeight: '600',

    lineHeight: 17,
  },

  // ----------------------------------------------------
  // BUTTON
  // ----------------------------------------------------

  closeButton: {
    width: '100%',

    marginBottom: 0,

    borderRadius: SIZES.radius,

    backgroundColor: COLORS.primary,
  },

  closeText: {
    color: COLORS.white,

    fontSize: 14,
    fontWeight: '700',
  },
});