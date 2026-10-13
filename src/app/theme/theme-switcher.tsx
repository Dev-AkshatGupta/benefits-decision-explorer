import { Moon, Sun } from 'lucide-react';
import { useTheme } from './use-theme';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n/i18n';

export function ThemeSwitcher() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const nextTheme = resolvedTheme === 'dark' ? t('themeLight') : t('themeDark');

  return (
    <div className="flex shrink-0 items-center">
      <button
        type="button"
        aria-label={t('switchToTheme', { theme: nextTheme })}
        title={t('switchToTheme', { theme: nextTheme })}
        onClick={toggleTheme}
        className="inline-flex size-10 items-center justify-center rounded-lg border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {resolvedTheme === 'dark' ? (
          <Moon
            size={17}
            aria-hidden="true"
            className="text-muted-foreground"
          />
        ) : (
          <Sun size={17} aria-hidden="true" className="text-muted-foreground" />
        )}
      </button>
    </div>
  );
}
