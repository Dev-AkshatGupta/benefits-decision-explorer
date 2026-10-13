import type { NavigationItem } from '@/app/router/navigation';
import { PageContainer } from './page-container';
import { PageHeader } from './page-header';
export function PlaceholderPage({ page }: { page: NavigationItem }) {
  const Icon = page.icon;
  return (
    <PageContainer>
      <PageHeader title={page.title} description={page.description} />
      <section
        aria-labelledby="placeholder-title"
        className="rounded-xl border bg-card px-6 py-14 text-center shadow-sm sm:py-20"
      >
        <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl border bg-background text-primary">
          <Icon size={26} strokeWidth={1.5} aria-hidden="true" />
        </div>
        <span className="rounded-full border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Coming in a future step
        </span>
        <h2 id="placeholder-title" className="mt-5 text-lg font-semibold">
          Your {page.title.toLowerCase()} workspace starts here
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted-foreground">
          This area is ready for the next stage of development. Tools and
          workflows will be introduced incrementally.
        </p>
      </section>
      <p className="mt-5 text-xs leading-6 text-muted-foreground">
        This is a fictional portfolio environment. Simulated outcomes are never
        actual public-benefits determinations.
      </p>
    </PageContainer>
  );
}
