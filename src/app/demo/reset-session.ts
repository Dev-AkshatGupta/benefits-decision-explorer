import type { QueryClient } from '@tanstack/react-query';

let confirmedResetNavigation = false;

/** Draft guards read this only while completing an explicitly confirmed reset. */
export function isConfirmedDemoResetNavigation() {
  return confirmedResetNavigation;
}

/** Called only after a confirmed, successful repository reset. Reload clears local drafts/analyses. */
export function finishDemoReset(
  client: QueryClient,
  navigate = () => window.location.replace('/dashboard?demoReset=complete'),
) {
  confirmedResetNavigation = true;
  const finishNavigation = () => {
    // Keep the signal available to every listener during this unload event.
    queueMicrotask(() => {
      confirmedResetNavigation = false;
    });
  };
  window.addEventListener('beforeunload', finishNavigation, { once: true });
  try {
    client.clear();
    navigate();
  } catch (error) {
    confirmedResetNavigation = false;
    window.removeEventListener('beforeunload', finishNavigation);
    throw error;
  }
}
