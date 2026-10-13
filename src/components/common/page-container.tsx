import type { PropsWithChildren } from 'react';
export function PageContainer({ children }: PropsWithChildren) {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-7 lg:px-10 lg:py-10">
      {children}
    </div>
  );
}
