import { it, expect } from 'vitest';
import { resolveDemoMode, DemoConfigurationError } from './demo-mode';
it('uses explicit booleans and safe development/production defaults', () => {
  expect(resolveDemoMode(undefined, true)).toBe(true);
  expect(resolveDemoMode(undefined, false)).toBe(false);
  expect(resolveDemoMode('true', false)).toBe(true);
  expect(resolveDemoMode('false', true)).toBe(false);
});
it.each(['', 'TRUE', 'yes', '1', true, null])(
  'rejects ambiguous demo configuration %s',
  (value) => {
    expect(() => resolveDemoMode(value, true)).toThrow(DemoConfigurationError);
  },
);
