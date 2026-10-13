import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from './theme-provider';
import { ThemeSwitcher } from './theme-switcher';

describe('theme selection', () => {
  let systemPreference = false;
  let systemListener: (() => void) | undefined;

  beforeEach(() => {
    localStorage.removeItem('bde-theme');
    document.documentElement.classList.remove('dark');
    systemPreference = false;
    systemListener = undefined;
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        get matches() {
          return systemPreference;
        },
        addEventListener: (_event: string, listener: () => void) => {
          systemListener = listener;
        },
        removeEventListener: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    localStorage.removeItem('bde-theme');
    document.documentElement.classList.remove('dark');
    delete document.documentElement.dataset.theme;
    document.documentElement.style.colorScheme = '';
    vi.unstubAllGlobals();
  });

  it('toggles the active theme and remembers the explicit choice', () => {
    render(
      <ThemeProvider>
        <ThemeSwitcher />
      </ThemeProvider>,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Switch to dark mode' }),
    );

    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('bde-theme')).toBe('dark');

    fireEvent.click(
      screen.getByRole('button', { name: 'Switch to light mode' }),
    );
    expect(document.documentElement).not.toHaveClass('dark');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('follows system preference while System is selected', () => {
    render(
      <ThemeProvider>
        <ThemeSwitcher />
      </ThemeProvider>,
    );

    systemPreference = true;
    act(() => systemListener?.());

    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement.dataset.theme).toBe('system');
    expect(
      screen.getByRole('button', { name: 'Switch to light mode' }),
    ).toBeVisible();
  });
});
