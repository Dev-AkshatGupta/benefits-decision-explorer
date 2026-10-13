import * as Dialog from '@radix-ui/react-dialog';
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { ThemeSwitcher } from '@/app/theme/theme-switcher';
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
      <ThemeSwitcher />
    </header>
  );
}
