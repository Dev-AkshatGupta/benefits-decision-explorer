import { SearchX, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
export function PatientEmptyState({
  filtered,
  onClear,
}: {
  filtered: boolean;
  onClear: () => void;
}) {
  const Icon = filtered ? SearchX : UsersRound;
  return (
    <div className="px-5 py-16 text-center">
      <Icon
        size={30}
        aria-hidden="true"
        className="mx-auto mb-4 text-muted-foreground"
      />
      <h2 className="font-semibold">
        {filtered
          ? 'No patients match your current filters.'
          : 'No patients yet'}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {filtered
          ? 'Try a different name or adjust your filters.'
          : 'Patient records will appear here when they are available.'}
      </p>
      {filtered && (
        <Button variant="outline" onClick={onClear} className="mt-5">
          Clear search and filters
        </Button>
      )}
    </div>
  );
}
