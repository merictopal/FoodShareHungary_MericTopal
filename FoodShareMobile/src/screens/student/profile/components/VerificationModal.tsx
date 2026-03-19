import React from 'react';
import { View, Text, TouchableOpacity, Modal, TouchableWithoutFeedback, Image } from 'react-native';
import { Button } from '../../../../components/Button';
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
    { id: 'student', label: 'Student ID' }, 
    { id: 'pensioner', label: '65+ Age' }, 
    { id: 'social', label: 'Social Relief' }
  ];

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.verificationModalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('verify_action')}</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}>
                  <Text style={styles.closeIconText}>✕</Text>
                </TouchableOpacity>
              </View>
              
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
                    <Text style={styles.docUploadIcon}>📸</Text>
                    <Text style={styles.docUploadText}>{t('add_photo')}</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Button title={t('save')} onPress={onUpload} loading={uploadingDoc} style={{ width: '100%', marginTop: 10 }} />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};