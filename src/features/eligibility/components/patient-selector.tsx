import { useEffect, useState, type KeyboardEvent } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePatients } from '../../patients/api/patient-queries';
import { useTranslation } from 'react-i18next';
export function PatientSelector({
  patientId,
  disabled,
  onSelect,
}: {
  patientId: string;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState({ search: '', page: 1 });
  useEffect(() => {
    if (input.trim() === query.search) return;
    const timer = window.setTimeout(
      () => setQuery({ search: input.trim(), page: 1 }),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [input, query.search]);
  const patients = usePatients({
    ...query,
    pageSize: 10,
    sortBy: 'fullName',
    sortOrder: 'asc',
  });
  const searching = input.trim() !== query.search || patients.isFetching;
  const keys = (event: KeyboardEvent<HTMLElement>) => {
    const buttons = Array.from(
      event.currentTarget
        .closest('[data-patient-selector]')
        ?.querySelectorAll<HTMLButtonElement>(
          '[data-patient-option]:not(:disabled)',
        ) ?? [],
    );
    if (!buttons.length) return;
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    let target: HTMLButtonElement | undefined;
    if (event.key === 'ArrowDown')
      target = buttons[(index + 1) % buttons.length];
    else if (event.key === 'ArrowUp')
      target = buttons[index <= 0 ? buttons.length - 1 : index - 1];
    else if (event.key === 'Home' && index >= 0) target = buttons[0];
    else if (event.key === 'End' && index >= 0)
      target = buttons[buttons.length - 1];
    if (target) {
      event.preventDefault();
      target.focus();
    }
  };
  return (
    <section
      aria-labelledby="select-patient-title"
      data-patient-selector
      className="rounded-xl border bg-card p-5 sm:p-6"
    >
      <h2 id="select-patient-title" className="text-lg font-semibold">
        {t('selectPatient')}
      </h2>
      <label
        htmlFor="screening-patient-search"
        className="mb-2 mt-4 block text-sm font-medium"
      >
        {t('searchPatientName')}
      </label>
      <div className="relative">
        <Search
          size={17}
          aria-hidden="true"
          className="absolute left-3 top-3.5 text-muted-foreground"
        />
        <input
          id="screening-patient-search"
          value={input}
          disabled={disabled}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={keys}
          maxLength={100}
          autoComplete="off"
          placeholder={t('firstOrLastName')}
          className="form-control w-full pl-10"
        />
      </div>
      <p role="status" className="my-3 text-xs text-muted-foreground">
        {searching
          ? t('searchingPatients')
          : patients.data
            ? t('searchKeyboardHint', {
                count: patients.data.pagination.totalItems,
              })
            : t('loadingPatients')}
      </p>
      {patients.isError ? (
        <div role="alert">
          <p className="text-sm">{t('patientSearchUnavailable')}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-2"
            onClick={() => void patients.refetch()}
          >
            {t('retryPatientSearch')}
          </Button>
        </div>
      ) : (
        <ul
          aria-label={t('patientSearchResults')}
          className="max-h-64 space-y-1 overflow-y-auto"
        >
          {patients.data?.data.map((patient) => (
            <li key={patient.id}>
              <button
                type="button"
                data-patient-option
                aria-label={
                  patient.fullName + ', ' + patient.id + ', ' + patient.state
                }
                aria-pressed={patient.id === patientId}
                disabled={disabled || searching}
                onKeyDown={keys}
                onClick={() => onSelect(patient.id)}
                className={
                  'flex min-h-14 w-full flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left hover:bg-muted disabled:opacity-60 ' +
                  (patient.id === patientId
                    ? 'border-primary bg-accent'
                    : 'border-transparent')
                }
              >
                <span className="min-w-0">
                  <span className="block break-words text-sm font-semibold">
                    {patient.fullName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {patient.id} · {patient.state}
                  </span>
                </span>
                {patient.id === patientId && (
                  <span className="text-xs font-medium text-primary">
                    Selected
                  </span>
                )}
              </button>
            </li>
          ))}
          {patients.data?.data.length === 0 && (
            <li className="py-5 text-sm text-muted-foreground">
              No patients match this name. Try another search.
            </li>
          )}
        </ul>
      )}
      {patients.data && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <span className="text-xs text-muted-foreground">
            Page {patients.data.pagination.totalPages ? query.page : 0} of{' '}
            {patients.data.pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={disabled || searching || query.page <= 1}
              onClick={() =>
                setQuery((previous) => ({
                  ...previous,
                  page: previous.page - 1,
                }))
              }
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={
                disabled ||
                searching ||
                query.page >= patients.data.pagination.totalPages
              }
              onClick={() =>
                setQuery((previous) => ({
                  ...previous,
                  page: previous.page + 1,
                }))
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}
      {patientId && (
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          className="mt-3"
          onClick={() => onSelect('')}
        >
          Clear selected patient
        </Button>
      )}
    </section>
  );
}
