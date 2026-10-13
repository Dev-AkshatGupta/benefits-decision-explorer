import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from './resources';

export type AppLanguage = 'en' | 'es';
export const languagePreferenceKey = 'bde-language';

function readSavedLanguage(): AppLanguage {
  try {
    return window.localStorage.getItem(languagePreferenceKey) === 'es'
      ? 'es'
      : 'en';
  } catch {
    return 'en';
  }
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: readSavedLanguage(),
    fallbackLng: 'en',
    supportedLngs: ['en', 'es'],
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

function updateDocumentLanguage(language: string) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language.startsWith('es') ? 'es' : 'en';
  }
}

updateDocumentLanguage(i18n.resolvedLanguage ?? i18n.language);
i18n.on('languageChanged', updateDocumentLanguage);

export default i18n;
