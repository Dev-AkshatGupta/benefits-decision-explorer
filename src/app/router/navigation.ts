import {
  LayoutDashboard,
  UsersRound,
  ClipboardCheck,
  FileText,
  ListTodo,
  CalendarRange,
  Settings,
  type LucideIcon,
} from 'lucide-react';
export interface NavigationItem {
  title: string;
  path: string;
  description: string;
  icon: LucideIcon;
}
export const navigation: NavigationItem[] = [
  {
    title: 'Dashboard',
    path: '/dashboard',
    description:
      'A central view of coordination priorities, patient activity, and upcoming follow-ups.',
    icon: LayoutDashboard,
  },
  {
    title: 'Patients',
    path: '/patients',
    description:
      'Manage synthetic patient profiles, household information, and coordination details.',
    icon: UsersRound,
  },
  {
    title: 'Eligibility Screening',
    path: '/eligibility',
    description:
      'Explore fictional eligibility rules and understand the reasoning behind simulated outcomes.',
    icon: ClipboardCheck,
  },
  {
    title: 'Policies',
    path: '/policies',
    description:
      'Review configurable eligibility policies and compare changes between policy versions.',
    icon: FileText,
  },
  {
    title: 'Care Tasks',
    path: '/tasks',
    description:
      'Organize benefit applications, follow-ups, renewals, and coordination tasks.',
    icon: ListTodo,
  },
  {
    title: 'Coverage Timeline',
    path: '/coverage',
    description:
      'Explore coverage periods and upcoming renewals in a clear chronological view.',
    icon: CalendarRange,
  },
  {
    title: 'Settings',
    path: '/settings',
    description:
      'Configure workspace preferences for a fictional care coordination team.',
    icon: Settings,
  },
];
