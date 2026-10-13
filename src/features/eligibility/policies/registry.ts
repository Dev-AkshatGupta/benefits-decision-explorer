import {
  demoHealth2025,
  demoHealth2026,
  demoNutrition2025,
  demoFamily2025,
  demoNutrition,
  demoChildcare,
  demoHousing,
  demoFamily,
} from './demo-programs';
import { validatePolicyRegistry } from '../engine/policy-selector';
import type { DeepReadonly } from '../domain/types';
/** Protect published definitions at runtime in addition to readonly TypeScript contracts. */
function freezePolicy<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezePolicy(child);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}
export const demoPolicyRegistry = freezePolicy(
  validatePolicyRegistry([
    demoHealth2025,
    demoHealth2026,
    demoNutrition2025,
    demoNutrition,
    demoChildcare,
    demoHousing,
    demoFamily2025,
    demoFamily,
  ]),
);
