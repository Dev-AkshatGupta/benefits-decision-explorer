import {
  LayoutDashboard,
  Info,
  UsersRound,
  ClipboardCheck,
  FileText,
  ListTodo,
  CalendarRange,
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
      'Start a patient review or explore the demonstration workflows.',
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
      'Compare fictional policy versions and review their effect on synthetic records.',
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
    title: 'About this demo',
    path: '/about',
    description: 'Learn how the demonstration data and results should be used.',
    icon: Info,
  },
];
