import { Moon, Sun } from 'lucide-react';
import type { ThemePreference } from './theme-context';
import { useTheme } from './use-theme';

export function ThemeSwitcher() {
  const { preference, setPreference } = useTheme();

  return (
    <div className="flex shrink-0 items-center gap-2">
      {preference === 'dark' ? (
        <Moon size={17} aria-hidden="true" className="text-muted-foreground" />
      ) : (
        <Sun size={17} aria-hidden="true" className="text-muted-foreground" />
      )}
      <label htmlFor="color-theme" className="sr-only">
        Color theme
      </label>
      <select
        id="color-theme"
        aria-label="Color theme"
        className="form-control min-h-10 w-[6.25rem] px-2 text-xs sm:w-auto sm:min-w-28 sm:text-sm"
        value={preference}
        onChange={(event) =>
          setPreference(event.target.value as ThemePreference)
        }
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>
  );
}
