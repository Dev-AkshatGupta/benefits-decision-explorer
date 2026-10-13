import { useMemo, useState, type PropsWithChildren } from 'react';
import { ScreeningSessionContext } from './screening-session-context';
import type { ScreeningSnapshot } from './screening-snapshot';
export function ScreeningSessionProvider({ children }: PropsWithChildren) {
  const [snapshot, setSnapshot] = useState<ScreeningSnapshot | null>(null);
  const value = useMemo(() => ({ snapshot, setSnapshot }), [snapshot]);
  return (
    <ScreeningSessionContext.Provider value={value}>
      {children}
    </ScreeningSessionContext.Provider>
  );
}
