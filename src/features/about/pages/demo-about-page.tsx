import { Link } from 'react-router';
import { ArrowRight, CircleHelp, ShieldCheck } from 'lucide-react';
import { navigation } from '@/app/router/navigation';
import { PageContainer } from '@/components/common/page-container';
import { PageHeader } from '@/components/common/page-header';
import { useDemoMode } from '@/app/demo/demo-context';

const links = navigation.filter((item) =>
  ['/patients', '/eligibility', '/policies'].includes(item.path),
);

export function DemoAboutPage() {
  const demoMode = useDemoMode();

  return (
    <PageContainer>
      <PageHeader
        title="About this demo"
        description="How fictional data, demonstration policies, and simulated results are used in this workspace."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section
          aria-labelledby="fictional-data-title"
          className="rounded-xl border bg-card p-5 shadow-sm sm:p-6"
        >
          <div className="flex items-start gap-3">
            <ShieldCheck
              className="mt-0.5 shrink-0 text-primary"
              size={20}
              aria-hidden="true"
            />
            <div>
              <h2 id="fictional-data-title" className="font-semibold">
                Fictional records and policies
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Patients, coordinators, benefit programs, policy thresholds, and
                outcomes in this project are synthetic. Screening is a decision
                support demonstration, not an official eligibility determination
                or a substitute for a program administrator.
              </p>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="data-handling-title"
          className="rounded-xl border bg-card p-5 shadow-sm sm:p-6"
        >
          <div className="flex items-start gap-3">
            <CircleHelp
              className="mt-0.5 shrink-0 text-primary"
              size={20}
              aria-hidden="true"
            />
            <div>
              <h2 id="data-handling-title" className="font-semibold">
                How this environment works
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {demoMode
                  ? 'Demo changes stay in this browser tab and are discarded on refresh. Use the reset control in the banner to restore the original synthetic records.'
                  : 'This build does not include a demonstration data service. Patient and coordination workflows require a compatible API.'}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Do not enter real personal or health information. This
                independent project is not affiliated with ITO Health.
              </p>
            </div>
          </div>
        </section>
      </div>

      <section aria-labelledby="about-links-title" className="mt-8">
        <h2 id="about-links-title" className="mb-3 text-base font-semibold">
          Explore the application
        </h2>
        <ul className="divide-y rounded-xl border bg-card shadow-sm">
          {links.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className="flex min-h-14 items-center justify-between gap-4 px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
              >
                <span>
                  <span className="block font-medium">{item.title}</span>
                  <span className="mt-1 block leading-5 text-muted-foreground">
                    {item.description}
                  </span>
                </span>
                <ArrowRight
                  size={17}
                  className="shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </PageContainer>
  );
}
