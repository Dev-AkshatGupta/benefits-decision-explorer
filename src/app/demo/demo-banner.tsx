import { useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { useDemoMode } from './demo-context';
import { resetDemoData } from './demo-api';
import { finishDemoReset } from './reset-session';
export function DemoBanner() {
  const enabled = useDemoMode(),
    client = useQueryClient(),
    mutations = useIsMutating();
  const location = useLocation();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const guard = useRef(false);
  if (!enabled) return null;
  const restored =
    location.pathname === '/dashboard' &&
    new URLSearchParams(location.search).get('demoReset') === 'complete';
  async function reset() {
    if (guard.current || mutations) return;
    guard.current = true;
    setBusy(true);
    setError('');
    try {
      await client.cancelQueries();
      await resetDemoData();
      finishDemoReset(client);
    } catch {
      setError(
        'Reset could not be confirmed. Try again; repeating a reset is safe.',
      );
      guard.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="Demonstration mode"
      className="shrink-0 border-b bg-accent px-4 py-2 sm:px-7 lg:px-10"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 text-xs leading-5">
          <p className="font-semibold text-primary">
            Demonstration mode · Synthetic data only
          </p>
          <p>
            Changes stay in this tab and are lost on refresh. Use fictional
            information only.
          </p>
          {restored && (
            <p role="status">
              Demonstration data restored. All session drafts and analyses were
              cleared.
            </p>
          )}
        </div>
        <Dialog.Root
          open={open}
          onOpenChange={(value) => {
            if (!busy) {
              setOpen(value);
              if (value) setError('');
            }
          }}
        >
          <Dialog.Trigger asChild>
            <Button variant="outline" disabled={mutations > 0 || busy}>
              Reset demo data
            </Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-[70] bg-overlay/50" />
            <Dialog.Content
              className="fixed left-1/2 top-1/2 z-[80] max-h-[calc(100svh-2rem)] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-card p-6 shadow-xl"
              onEscapeKeyDown={(event) => {
                if (busy) event.preventDefault();
              }}
              onInteractOutside={(event) => {
                if (busy) event.preventDefault();
              }}
            >
              <Dialog.Title className="text-lg font-semibold">
                Reset demonstration data?
              </Dialog.Title>
              <Dialog.Description className="mt-3 text-sm leading-6">
                Restore all synthetic patients, households, coordinators, tasks,
                coverage records and events. Discard unsaved changes, screening
                snapshots, simulations and analyses. After the reset completes,
                the page reloads to the dashboard. Other tabs are unchanged.
              </Dialog.Description>
              {error && (
                <p role="alert" className="mt-4 text-sm text-warning">
                  {error}
                </p>
              )}
              {busy && (
                <p role="status" className="mt-4 text-sm">
                  Restoring demonstration data…
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  disabled={busy || mutations > 0}
                  onClick={() => void reset()}
                >
                  {busy ? 'Resetting…' : 'Confirm reset'}
                </Button>
                <Dialog.Close asChild>
                  <Button variant="outline" disabled={busy}>
                    Keep current data
                  </Button>
                </Dialog.Close>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </section>
  );
}
