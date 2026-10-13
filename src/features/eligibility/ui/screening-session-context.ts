import {
  createContext,
  useContext,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { ScreeningSnapshot } from './screening-snapshot';
export const ScreeningSessionContext = createContext<{
  snapshot: ScreeningSnapshot | null;
  setSnapshot: Dispatch<SetStateAction<ScreeningSnapshot | null>>;
} | null>(null);
export function useScreeningSession() {
  const session = useContext(ScreeningSessionContext);
  if (!session) throw new Error('Screening requires its session provider.');
  return session;
}
