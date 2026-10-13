import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/errors';
export function SaveFeedback({
  error,
  onReload,
  busy,
}: {
  error: Error | null;
  onReload: () => Promise<void>;
  busy: boolean;
}) {
  const [reloadFailed, setReloadFailed] = useState(false);
  if (!error) return null;
  const conflict = error instanceof ApiError && error.status === 409;
  return (
    <div
      role="alert"
      className="my-4 rounded-lg border bg-background p-4 text-sm"
    >
      <p className="font-semibold">
        {conflict ? 'This record has changed' : 'Changes could not be saved'}
      </p>
      <p className="mt-2">
        {conflict
          ? 'Another update was saved after you began editing. Reload current data before saving. Reloading replaces your unsaved changes.'
          : 'Your edits are preserved. Check your information and try saving again.'}
      </p>
      {conflict && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          className="mt-3"
          onClick={async () => {
            setReloadFailed(false);
            try {
              await onReload();
            } catch {
              setReloadFailed(true);
            }
          }}
        >
          {busy ? 'Reloading current data…' : 'Reload current data'}
        </Button>
      )}
      {reloadFailed && (
        <p className="mt-3">
          Current data could not be reloaded. Your edits are preserved; try
          again.
        </p>
      )}
    </div>
  );
}
