// Language-aware text helpers shared by several screens.

/**
 * Uppercases text for the app's current language rather than the device locale.
 * Plain `toUpperCase()` turns Turkish "Bildirimler" into "BILDIRIMLER"; Turkish needs
 * the dotted capital İ for i and the dotless I for ı. Other languages use the default rules.
 */
export const toLangUpper = (text: string, lang: string): string => {
  if (lang === 'tr') {
    return text.replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase();
  }
  return text.toUpperCase();
};
