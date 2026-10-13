import { Link } from 'react-router';
import { ArrowUpRight } from 'lucide-react';
import { navigation } from '@/app/router/navigation';
import { PageContainer } from '@/components/common/page-container';
import { PageHeader } from '@/components/common/page-header';
import { useTranslation } from 'react-i18next';

const featuredPaths = [
  '/patients',
  '/eligibility',
  '/policies',
  '/tasks',
  '/coverage',
];

export function DashboardPage() {
  const { t } = useTranslation();
  const destinations = navigation.filter((item) =>
    featuredPaths.includes(item.path),
  );

  return (
    <PageContainer>
      <PageHeader
        title={t('startWithPatient')}
        description={t('dashboardIntro')}
      />

      <section aria-labelledby="explore-title">
        <h2 id="explore-title" className="mb-4 text-base font-semibold">
          {t('chooseWorkflow')}
        </h2>
        <nav aria-label={t('exploreDemo')}>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {destinations.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className="group flex min-h-36 h-full items-start gap-4 rounded-xl border bg-card p-5 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2 font-medium text-foreground">
                        {t(item.titleKey)}
                        <ArrowUpRight
                          size={16}
                          className="shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none"
                          aria-hidden="true"
                        />
                      </span>
                      <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                        {t(item.descriptionKey)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </section>
    </PageContainer>
  );
}
