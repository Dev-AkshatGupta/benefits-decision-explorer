import { NavLink } from 'react-router';
import type { NavigationItem } from '@/app/router/navigation';
import { useTranslation } from 'react-i18next';
export function NavItem({
  item,
  onNavigate,
}: {
  item: NavigationItem;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const { t } = useTranslation();
  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      title={t(item.titleKey)}
      className={({ isActive }) =>
        'nav-item ' + (isActive ? 'nav-item-active' : '')
      }
    >
      <Icon size={19} aria-hidden="true" className="shrink-0" />
      <span className="sidebar-label truncate">{t(item.titleKey)}</span>
    </NavLink>
  );
}
