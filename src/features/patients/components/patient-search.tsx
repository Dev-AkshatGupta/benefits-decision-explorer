import { useEffect, useEffectEvent, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
export function PatientSearch({
  search,
  onSearch,
  label = 'Search patients',
  placeholder = 'Search by first or last name',
}: {
  search: string;
  label?: string;
  placeholder?: string;
  onSearch: (value: string) => void;
}) {
  const [draft, setDraft] = useState({
    input: search,
    acknowledgedSearch: search,
    requestedSearch: null as string | null,
  });
  // Synchronize external URL navigation, but retain the input node and newer
  // keystrokes when our own debounced update is acknowledged.
  if (draft.acknowledgedSearch !== search)
    setDraft({
      input: draft.requestedSearch === search ? draft.input : search,
      acknowledgedSearch: search,
      requestedSearch: null,
    });
  const input = draft.input;
  // Parent query updates can supply a new callback without changing the search.
  // Read its latest implementation without restarting the debounce deadline.
  const commitSearch = useEffectEvent((value: string) => onSearch(value));
  useEffect(() => {
    if (input.trim() === search) return;
    const timeout = window.setTimeout(() => {
      setDraft((previous) => ({ ...previous, requestedSearch: input.trim() }));
      commitSearch(input.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [input, search]);
  return (
    <div className="min-w-0 flex-1">
      <label
        htmlFor="patient-search"
        className="mb-2 block text-xs font-medium"
      >
        {label}
      </label>
      <div className="relative">
        <Search
          size={17}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-3.5 text-muted-foreground"
        />
        <input
          id="patient-search"
          type="text"
          autoComplete="off"
          maxLength={100}
          placeholder={placeholder}
          className="form-control w-full pl-10 pr-11"
          value={input}
          onChange={(event) =>
            setDraft((previous) => ({ ...previous, input: event.target.value }))
          }
        />
        {input && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0.5 top-0.5"
            aria-label="Clear search"
            onClick={() => {
              setDraft({
                input: '',
                acknowledgedSearch: search,
                requestedSearch: '',
              });
              onSearch('');
            }}
          >
            <X size={16} aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
