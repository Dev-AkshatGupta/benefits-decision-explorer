export function PatientTableSkeleton({ pageSize }: { pageSize: number }) {
  return (
    <div role="status" aria-label="Loading patients">
      <span className="sr-only">Loading patients…</span>
      <div aria-hidden="true" className="space-y-3 p-4">
        {Array.from({ length: pageSize }, (_, index) => (
          <div
            key={index}
            className="flex h-16 items-center gap-6 rounded-lg border p-4"
          >
            <div className="h-3 w-2/5 rounded bg-muted" />
            <div className="h-3 w-1/5 rounded bg-muted" />
            <div className="h-3 w-1/5 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
