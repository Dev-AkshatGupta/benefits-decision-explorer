import { useRef } from 'react';
export function useDialogFocus() {
  const previous = useRef<HTMLElement | SVGElement | null>(null);
  return {
    onOpenAutoFocus: () => {
      previous.current =
        document.activeElement instanceof HTMLElement ||
        document.activeElement instanceof SVGElement
          ? document.activeElement
          : null;
    },
    onCloseAutoFocus: (event: Event) => {
      event.preventDefault();
      (previous.current?.isConnected
        ? previous.current
        : document.getElementById('main-content')
      )?.focus();
    },
  };
}
