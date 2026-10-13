import { useEffect, useState } from 'react';
import { localCalendarDate } from '../domain/tasks';
export function useLocalToday() {
  const [today, setToday] = useState(localCalendarDate);
  useEffect(() => {
    const timer = window.setInterval(
      () => setToday(localCalendarDate()),
      30000,
    );
    const refresh = () => setToday(localCalendarDate());
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  return today;
}
