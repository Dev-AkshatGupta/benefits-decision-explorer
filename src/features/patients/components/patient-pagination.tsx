import { Button } from '@/components/ui/button';
import type { PatientListResponse } from '../domain/schemas';
export function PatientPagination({
  pagination,
  pageSize,
  busy,
  onPage,
  onPageSize,
}: {
  pagination: PatientListResponse['pagination'];
  pageSize: number;
  busy: boolean;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  const { page, totalItems, totalPages } = pagination;
  const first =
    totalItems && page <= totalPages ? (page - 1) * pagination.pageSize + 1 : 0;
  const last = first ? Math.min(page * pagination.pageSize, totalItems) : 0;
  return (
    <nav
      aria-label="Patient pagination"
      className="flex flex-wrap items-center justify-between gap-4 border-t p-4"
    >
      <p className="text-xs text-muted-foreground">
        Showing {first}–{last} of {totalItems} patients
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="page-size" className="text-xs text-muted-foreground">
          Rows per page
        </label>
        <select
          id="page-size"
          value={pageSize}
          className="form-control w-20"
          onChange={(event) => onPageSize(Number(event.target.value))}
        >
          {[10, 20, 50].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <span className="text-xs">
          Page {totalPages ? page : 0} of {totalPages}
        </span>
        <Button
          variant="outline"
          className="min-h-11"
          aria-label="Previous page"
          disabled={busy || page <= 1 || totalPages === 0}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          className="min-h-11"
          aria-label="Next page"
          disabled={busy || page >= totalPages || totalPages === 0}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
