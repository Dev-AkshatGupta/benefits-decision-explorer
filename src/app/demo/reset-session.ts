import type { QueryClient } from '@tanstack/react-query';

let confirmedResetNavigation = false;

/** Draft guards read this only while completing an explicitly confirmed reset. */
export function isConfirmedDemoResetNavigation() {
  return confirmedResetNavigation;
}

export function getDemoResetDestination(baseUrl = import.meta.env.BASE_URL) {
  const basePath = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${basePath}dashboard?demoReset=complete`;
}

/** Called only after a confirmed, successful repository reset. Reload clears local drafts/analyses. */
export function finishDemoReset(
  client: QueryClient,
  navigate = () => window.location.replace(getDemoResetDestination()),
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
