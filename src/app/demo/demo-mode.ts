export class DemoConfigurationError extends Error {
  constructor() {
    super(
      "VITE_DEMO_MODE must be 'true' or 'false'. Rebuild with a valid public demo flag.",
    );
    this.name = 'DemoConfigurationError';
  }
}
export function resolveDemoMode(value: unknown, development: boolean): boolean {
  if (value === undefined) return development;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new DemoConfigurationError();
}
