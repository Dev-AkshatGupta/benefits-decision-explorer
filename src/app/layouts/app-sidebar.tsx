import { HeartPulse } from 'lucide-react';
import { Link } from 'react-router';
import { navigation } from '@/app/router/navigation';
import { NavItem } from '@/components/common/nav-item';
export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Link
        to="/dashboard"
        onClick={onNavigate}
        aria-label="Benefits Decision Explorer home"
        className="brand-link flex h-20 shrink-0 items-center gap-3 border-b px-5"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <HeartPulse size={23} aria-hidden="true" />
        </span>
        <span className="sidebar-label text-sm font-semibold leading-5">
          Benefits Decision
          <br />
          Explorer
        </span>
      </Link>
      <nav
        aria-label="Main navigation"
        className="min-h-0 flex-1 overflow-y-auto px-3 py-7"
      >
        <p className="sidebar-label mb-3 px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Workspace
        </p>
        <ul className="space-y-1.5">
          {navigation
            .filter((item) => item.path !== '/about')
            .map((item) => (
              <li key={item.path}>
                <NavItem item={item} {...(onNavigate ? { onNavigate } : {})} />
              </li>
            ))}
        </ul>
        <div className="my-6 border-t" />
        <ul>
          {navigation
            .filter((item) => item.path === '/about')
            .map((item) => (
              <li key={item.path}>
                <NavItem item={item} {...(onNavigate ? { onNavigate } : {})} />
              </li>
            ))}
        </ul>
      </nav>
    </div>
  );
}
