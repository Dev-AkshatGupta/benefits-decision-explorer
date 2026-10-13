import { Moon, Sun } from 'lucide-react';
import { useTheme } from './use-theme';

export function ThemeSwitcher() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';

  return (
    <div className="flex shrink-0 items-center">
      <button
        type="button"
        aria-label={`Switch to ${nextTheme} mode`}
        title={`Switch to ${nextTheme} mode`}
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
