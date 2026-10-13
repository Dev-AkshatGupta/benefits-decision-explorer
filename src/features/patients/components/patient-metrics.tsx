import { UsersRound, UserCheck, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePatientStats } from '../api/patient-queries';
export function PatientMetrics() {
  const query = usePatientStats();
  const metrics = [
    {
      label: 'Total Patients',
      count: query.data?.totalPatients,
      icon: UsersRound,
    },
    {
      label: 'Active Patients',
      count: query.data?.activePatients,
      icon: UserCheck,
    },
    {
      label: 'Pending Review',
      count: query.data?.pendingReview,
      icon: ClipboardList,
    },
  ];
  return (
    <section aria-label="Patient summary" className="mb-7">
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {metrics.map(({ label, count, icon: Icon }) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-xl border bg-card p-3 shadow-sm sm:p-5"
          >
            <div>
              <p className="min-h-8 text-[11px] font-medium text-muted-foreground sm:min-h-0 sm:text-xs">
                {label}
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                {count?.toLocaleString('en-US') ?? '—'}
              </p>
            </div>
            <span className="hidden rounded-xl bg-background p-3 text-primary sm:block">
              <Icon size={21} aria-hidden="true" />
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Counts across the entire workspace, independent of filters.
      </p>
      {query.isPending && (
        <p role="status" className="sr-only">
          Loading patient summary…
        </p>
      )}
      {query.isError && (
        <div
          role="alert"
          className="mt-3 flex flex-wrap items-center gap-3 text-sm"
        >
          <p>Patient counts could not be loaded.</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Retry summary
          </Button>
        </div>
      )}
    </section>
  );
}
