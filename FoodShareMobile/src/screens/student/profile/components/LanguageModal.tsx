import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { BottomSheet } from '../../../../components/BottomSheet';
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
    <BottomSheet visible={visible} onClose={onClose} title={t('lang_change')} animationType="fade">
      {languages.map((l) => (
        <TouchableOpacity
          key={l.code}
          style={[styles.langBtn, currentLang === l.code && styles.langBtnActive]}
          onPress={() => onSelectLanguage(l.code)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ selected: currentLang === l.code }}
        >
          <Text style={[styles.langText, currentLang === l.code && styles.langTextActive]}>{l.label}</Text>
          <View style={[styles.langBadge, currentLang === l.code && styles.langBadgeActive]}>
            <Text style={[styles.langBadgeText, currentLang === l.code && styles.langBadgeTextActive]}>{l.subLabel}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </BottomSheet>
  );
};
