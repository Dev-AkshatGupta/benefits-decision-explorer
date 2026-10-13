import * as Dialog from '@radix-ui/react-dialog';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
export function UnsavedChangesDialog({
  open,
  onKeep,
  onDiscard,
  busy,
}: {
  open: boolean;
  onKeep: () => void;
  onDiscard: () => void;
  busy: boolean;
}) {
  const focus = useRef<HTMLElement | null>(null);
  const restore = useRef(true);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) onKeep();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-overlay/50" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[80] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 shadow-xl"
          onOpenAutoFocus={() => {
            restore.current = true;
            focus.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (restore.current && focus.current?.isConnected)
              focus.current.focus();
            else document.getElementById('main-content')?.focus();
          }}
        >
          <Dialog.Title className="text-lg font-semibold">
            Discard unsaved changes?
          </Dialog.Title>
          <Dialog.Description className="mt-3 text-sm leading-6 text-muted-foreground">
            You have changes that have not been saved. Keep editing or discard
            them to continue.
          </Dialog.Description>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button type="button" onClick={onKeep}>
              Keep editing
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                restore.current = false;
                onDiscard();
              }}
            >
              Discard changes
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
