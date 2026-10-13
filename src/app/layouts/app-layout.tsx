import { lazy, Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { navigation } from '@/app/router/navigation';
import { Button } from '@/components/ui/button';
import { AppSidebar } from './app-sidebar';
import { AppHeader } from './app-header';
import { ScreeningSessionProvider } from '@/features/eligibility/ui/screening-session-provider';
import { useDemoMode } from '../demo/demo-context';
import { useTranslation } from 'react-i18next';
const DemoBanner = lazy(() =>
  import('../demo/demo-banner').then((module) => ({
    default: module.DemoBanner,
  })),
);
export function AppLayout() {
  const { t } = useTranslation();
  const demoMode = useDemoMode();
  const [collapsed, setCollapsed] = useState(
    () => !window.matchMedia('(min-width: 1024px)').matches,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const title =
    (pathname.startsWith('/patients/')
      ? t('patientProfile')
      : pathname === '/eligibility/simulator'
        ? t('whatIfSimulator')
        : (() => {
            const item = navigation.find((entry) => pathname === entry.path);
            return item ? t(item.titleKey) : undefined;
          })()) ?? t('pageNotFound');
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 768px)');
    const closeDrawer = () => {
      if (desktop.matches) setMobileOpen(false);
    };
    desktop.addEventListener('change', closeDrawer);
    return () => desktop.removeEventListener('change', closeDrawer);
  }, []);
  return (
    <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
      <div className="flex h-svh overflow-hidden">
        <a href="#main-content" className="skip-link">
          {t('skipToContent')}
        </a>
        <aside
          id="desktop-sidebar"
          aria-label={t('applicationSidebar')}
          data-collapsed={collapsed}
          className="desktop-sidebar hidden shrink-0 border-r bg-card md:block"
        >
          <AppSidebar />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader
            title={title}
            collapsed={collapsed}
            onToggle={() => setCollapsed((value) => !value)}
          />
          <div className="min-h-0 flex-1 overflow-y-auto">
            {demoMode && (
              <Suspense
                fallback={
                  <p role="status" className="px-5 py-3 text-xs">
                    {t('loadingDemoControls')}
                  </p>
                }
              >
                <DemoBanner />
              </Suspense>
            )}
            <main id="main-content" tabIndex={-1}>
              <ScreeningSessionProvider>
                <Outlet />
              </ScreeningSessionProvider>
            </main>
            <footer className="mx-auto max-w-6xl px-5 pb-6 pt-2 text-xs leading-6 text-muted-foreground sm:px-7 lg:px-10">
              {t('independentDemoFooter')}
            </footer>
          </div>
        </div>
      </div>
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay fixed inset-0 z-40 bg-overlay/50" />
        <Dialog.Content
          className="mobile-drawer fixed inset-y-0 left-0 z-50 w-[min(20rem,calc(100vw-2rem))] bg-card shadow-xl"
          onCloseAutoFocus={(event) => {
            if (window.matchMedia('(min-width: 768px)').matches) {
              event.preventDefault();
              document.getElementById('desktop-sidebar-toggle')?.focus();
            }
          }}
        >
          <Dialog.Title className="sr-only">
            {t('workspaceNavigation')}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            {t('navigateCarePages')}
          </Dialog.Description>
          <Dialog.Close asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('closeNavigation')}
              className="absolute right-2 top-5"
            >
              <X size={18} aria-hidden="true" />
            </Button>
          </Dialog.Close>
          <AppSidebar onNavigate={() => setMobileOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
