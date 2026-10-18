import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Button } from '../../../../components/Button';
import { BottomSheet } from '../../../../components/BottomSheet';
import { COLORS } from '../../../../constants/theme';
import { styles } from '../styles';

interface VerificationModalProps {
  visible: boolean;
  onClose: () => void;
  t: any;
  docType: string;
  setDocType: (type: any) => void;
  docImage: any;
  onSelectImage: () => void;
  onUpload: () => void;
  uploadingDoc: boolean;
}

export const VerificationModal: React.FC<VerificationModalProps> = ({
  visible, onClose, t, docType, setDocType, docImage, onSelectImage, onUpload, uploadingDoc
}) => {
  const types = [
    { id: 'student', label: t('doc_type_student') },
    { id: 'pensioner', label: t('doc_type_pensioner') },
    { id: 'social', label: t('doc_type_social') }
  ];

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('verify_action')}>
      <View style={styles.docTypeContainer}>
        {types.map((type) => (
          <TouchableOpacity key={type.id} style={[styles.docTypeBtn, docType === type.id && styles.docTypeBtnActive]} onPress={() => setDocType(type.id)} activeOpacity={0.7}>
            <View style={[styles.docRadioBtn, docType === type.id && styles.docRadioBtnActive]}>
              {docType === type.id && <View style={styles.docRadioInner} />}
            </View>
            <Text style={[styles.docTypeText, docType === type.id && styles.docTypeTextActive]}>{type.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.docImageContainer}>
        {docImage?.uri ? (
          <View style={styles.docPreviewWrapper}>
            <Image source={{ uri: docImage.uri }} style={styles.docPreviewImage} />
            <TouchableOpacity onPress={onSelectImage} style={styles.docChangeBtn}>
              <Text style={styles.docChangeText}>{t('change_photo')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={onSelectImage} style={styles.docUploadBtn}>
            <Ionicons name="camera-outline" size={30} color={COLORS.textSub} style={styles.docUploadIcon} />
            <Text style={styles.docUploadText}>{t('add_photo')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <Button title={t('save')} onPress={onUpload} loading={uploadingDoc} style={{ width: '100%', marginTop: 10 }} />
    </BottomSheet>
  );
};
