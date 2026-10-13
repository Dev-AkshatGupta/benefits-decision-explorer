import { createContext } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeContextValue = {
  resolvedTheme: 'light' | 'dark';
  toggleTheme: () => void;
};

const defaultTheme: ThemeContextValue = {
  resolvedTheme: 'light',
  toggleTheme: () => undefined,
};

export const ThemeContext = createContext<ThemeContextValue>(defaultTheme);
