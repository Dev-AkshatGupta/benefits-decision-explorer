import { NavLink } from 'react-router';
import type { NavigationItem } from '@/app/router/navigation';
export function NavItem({
  item,
  onNavigate,
}: {
  item: NavigationItem;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      title={item.title}
      className={({ isActive }) =>
        'nav-item ' + (isActive ? 'nav-item-active' : '')
      }
    >
      <Icon size={19} aria-hidden="true" className="shrink-0" />
      <span className="sidebar-label truncate">{item.title}</span>
    </NavLink>
  );
}
