import { Button } from '@/components/ui/button';
export function RouteErrorPage() {
  return (
    <main className="mx-auto max-w-2xl p-8" role="alert">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="my-6">Please reload the application and try again.</p>
      <Button onClick={() => window.location.assign('/')}>Return home</Button>
    </main>
  );
}
