import * as Dialog from '@radix-ui/react-dialog';
import {
  Bell,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
export function AppHeader({
  title,
  collapsed,
  onToggle,
}: {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <header className="flex h-20 shrink-0 items-center justify-between gap-3 border-b bg-card px-4 sm:px-7 lg:px-10">
      <div className="flex min-w-0 items-center gap-3">
        <Dialog.Trigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open navigation"
          >
            <Menu size={20} aria-hidden="true" />
          </Button>
        </Dialog.Trigger>
        <Button
          id="desktop-sidebar-toggle"
          variant="ghost"
          size="icon"
          className="hidden md:inline-flex"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          aria-controls="desktop-sidebar"
          onClick={onToggle}
        >
          {collapsed ? (
            <PanelLeftOpen size={20} aria-hidden="true" />
          ) : (
            <PanelLeftClose size={20} aria-hidden="true" />
          )}
        </Button>
        <nav aria-label="Breadcrumb" className="min-w-0 text-sm">
          <ol className="flex min-w-0 items-center gap-2">
            <li className="hidden text-muted-foreground sm:block">
              <Link to="/dashboard" className="hover:text-foreground">
                Workspace
              </Link>
            </li>
            <li className="hidden sm:block">
              <ChevronRight
                size={14}
                className="text-muted-foreground"
                aria-hidden="true"
              />
            </li>
            <li aria-current="page" className="truncate font-medium">
              {title}
            </li>
          </ol>
        </nav>
      </div>
      <div className="flex shrink-0 items-center gap-3 sm:gap-5">
        <span
          role="img"
          aria-label="Notifications — preview only"
          title="Notifications are not available yet"
          className="flex size-9 items-center justify-center text-muted-foreground"
        >
          <Bell size={19} aria-hidden="true" />
        </span>
        <span className="h-8 border-l" aria-hidden="true" />
        <div className="flex items-center gap-3">
          <span
            className="flex size-9 items-center justify-center rounded-full bg-accent text-xs font-semibold text-primary"
            aria-hidden="true"
          >
            MC
          </span>
          <div className="hidden text-xs leading-5 sm:block">
            <p className="font-semibold">Morgan Chen</p>
            <p className="text-muted-foreground">Fictional care coordinator</p>
          </div>
          <span className="sr-only sm:hidden">
            Morgan Chen, fictional care coordinator
          </span>
        </div>
      </div>
    </header>
  );
}
