import type { ReactNode } from 'react';
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
      <div className="min-w-0 max-w-2xl">
        <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
          {description}
        </p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
