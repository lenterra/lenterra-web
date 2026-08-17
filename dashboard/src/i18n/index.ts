/**
 * Localisation.
 *
 * Same rule as the app (ADR-010): **Indonesian is the source locale, not a
 * translation of English.** A teacher in NTT is the primary reader; English is
 * the one allowed to lag.
 */

import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import id from './id.json';
import en from './en.json';

export const DEFAULT_LOCALE = 'id';

export function initI18n(): typeof i18next {
  if (!i18next.isInitialized) {
    void i18next.use(initReactI18next).init({
      lng: DEFAULT_LOCALE,
      fallbackLng: DEFAULT_LOCALE,
      resources: { id: { translation: id }, en: { translation: en } },
      interpolation: { escapeValue: false },
      returnNull: false,
    });
  }
  return i18next;
}

export { i18next };
