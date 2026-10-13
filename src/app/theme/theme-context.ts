import { createContext } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeContextValue = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const defaultTheme: ThemeContextValue = {
  preference: 'system',
  setPreference: () => undefined,
};

export const ThemeContext = createContext<ThemeContextValue>(defaultTheme);
