import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n, { languagePreferenceKey } from '@/lib/i18n/i18n';

export function LanguageSwitcher() {
  const { t, i18n: currentI18n } = useTranslation();
  const [announcement, setAnnouncement] = useState('');
  const language = currentI18n.resolvedLanguage?.startsWith('es') ? 'es' : 'en';

  async function changeLanguage(nextLanguage: 'en' | 'es') {
    await i18n.changeLanguage(nextLanguage);
    try {
      window.localStorage.setItem(languagePreferenceKey, nextLanguage);
    } catch {
      // The selected language still applies for this session if storage is disabled.
    }
    setAnnouncement(
      t('languageChanged', {
        language:
          nextLanguage === 'es' ? t('languageSpanish') : t('languageEnglish'),
      }),
    );
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="language-switcher" className="sr-only">
        {t('language')}
      </label>
      <select
        id="language-switcher"
        value={language}
        onChange={(event) =>
          void changeLanguage(event.target.value as 'en' | 'es')
        }
        className="h-10 max-w-32 rounded-lg border bg-card px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="en">{t('languageEnglish')}</option>
        <option value="es">{t('languageSpanish')}</option>
      </select>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
