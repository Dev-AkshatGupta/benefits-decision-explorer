import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { navigation } from '@/app/router/navigation';
import { Button } from '@/components/ui/button';
import { AppSidebar } from './app-sidebar';
import { AppHeader } from './app-header';
import { ScreeningSessionProvider } from '@/features/eligibility/ui/screening-session-provider';
export function AppLayout() {
  const [collapsed, setCollapsed] = useState(
    () => !window.matchMedia('(min-width: 1024px)').matches,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const title =
    (pathname.startsWith('/patients/')
      ? 'Patient profile'
      : pathname === '/eligibility/simulator'
        ? 'What-if Simulator'
        : navigation.find((item) => pathname === item.path)?.title) ??
    'Page not found';
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
          Skip to content
        </a>
        <aside
          id="desktop-sidebar"
          aria-label="Application sidebar"
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
            <main id="main-content" tabIndex={-1}>
              <ScreeningSessionProvider>
                <Outlet />
              </ScreeningSessionProvider>
            </main>
            <footer className="mx-auto max-w-6xl px-5 pb-6 pt-2 text-xs leading-6 text-muted-foreground sm:px-7 lg:px-10">
              Benefits Decision Explorer is an independent demonstration
              project. It is not affiliated with ITO Health. All patient
              records, policies, and eligibility results are fictional and must
              not be used for real benefit decisions.
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
          <Dialog.Title className="sr-only">Workspace navigation</Dialog.Title>
          <Dialog.Description className="sr-only">
            Navigate between care coordination pages.
          </Dialog.Description>
          <Dialog.Close asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close navigation"
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
