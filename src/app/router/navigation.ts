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
  titleKey: string;
  descriptionKey: string;
  path: string;
  description: string;
  icon: LucideIcon;
}
export const navigation: NavigationItem[] = [
  {
    title: 'Dashboard',
    titleKey: 'dashboard',
    descriptionKey: 'dashboardDescription',
    path: '/dashboard',
    description:
      'Start a patient review or explore the demonstration workflows.',
    icon: LayoutDashboard,
  },
  {
    title: 'Patients',
    titleKey: 'patients',
    descriptionKey: 'patientsDescription',
    path: '/patients',
    description:
      'Manage synthetic patient profiles, household information, and coordination details.',
    icon: UsersRound,
  },
  {
    title: 'Eligibility Screening',
    titleKey: 'eligibilityScreening',
    descriptionKey: 'eligibilityDescription',
    path: '/eligibility',
    description:
      'Explore fictional eligibility rules and understand the reasoning behind simulated outcomes.',
    icon: ClipboardCheck,
  },
  {
    title: 'Policies',
    titleKey: 'policies',
    descriptionKey: 'policiesDescription',
    path: '/policies',
    description:
      'Compare fictional policy versions and review their effect on synthetic records.',
    icon: FileText,
  },
  {
    title: 'Care Tasks',
    titleKey: 'careTasks',
    descriptionKey: 'tasksDescription',
    path: '/tasks',
    description:
      'Organize benefit applications, follow-ups, renewals, and coordination tasks.',
    icon: ListTodo,
  },
  {
    title: 'Coverage Timeline',
    titleKey: 'coverageTimeline',
    descriptionKey: 'coverageDescription',
    path: '/coverage',
    description:
      'Explore coverage periods and upcoming renewals in a clear chronological view.',
    icon: CalendarRange,
  },
  {
    title: 'About this demo',
    titleKey: 'aboutDemo',
    descriptionKey: 'aboutDescription',
    path: '/about',
    description: 'Learn how the demonstration data and results should be used.',
    icon: Info,
  },
];
