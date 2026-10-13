import { Component, type PropsWithChildren } from 'react';
import { Button } from '@/components/ui/button';
export class ErrorBoundary extends Component<
  PropsWithChildren,
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError)
      return (
        <main role="alert" className="mx-auto max-w-2xl p-8">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="my-6">Please reload the application and try again.</p>
          <Button onClick={() => window.location.reload()}>
            Reload application
          </Button>
        </main>
      );
    return this.props.children;
  }
}
