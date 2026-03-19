import React from 'react';
import { View, Text, TouchableOpacity, Modal, TouchableWithoutFeedback } from 'react-native';
import { styles } from '../styles';

interface LanguageModalProps {
  visible: boolean;
  onClose: () => void;
  currentLang: string;
  onSelectLanguage: (lang: string) => void;
  t: any;
}

export const LanguageModal: React.FC<LanguageModalProps> = ({ visible, onClose, currentLang, onSelectLanguage, t }) => {
  const languages = [
    { code: 'en', label: 'English', subLabel: 'EN' }, 
    { code: 'tr', label: 'Türkçe', subLabel: 'TR' }, 
    { code: 'hu', label: 'Magyar', subLabel: 'HU' }
  ];

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.langModalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('lang_change')}</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}>
                  <Text style={styles.closeIconText}>✕</Text>
                </TouchableOpacity>
              </View>
              {languages.map((l) => (
                <TouchableOpacity 
                  key={l.code} 
                  style={[styles.langBtn, currentLang === l.code && styles.langBtnActive]} 
                  onPress={() => onSelectLanguage(l.code)} 
                  activeOpacity={0.7}
                >
                  <Text style={[styles.langText, currentLang === l.code && styles.langTextActive]}>{l.label}</Text>
                  <View style={[styles.langBadge, currentLang === l.code && styles.langBadgeActive]}>
                    <Text style={[styles.langBadgeText, currentLang === l.code && styles.langBadgeTextActive]}>{l.subLabel}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};