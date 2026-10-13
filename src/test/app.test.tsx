import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { appRoutes } from '@/app/router/routes';
import { navigation } from '@/app/router/navigation';
import { AppProviders } from '@/app/providers/app-providers';
function viewport(width: number) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: width >= Number(query.match(/[0-9]+/)?.[0] ?? 0),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}
function renderRoute(path = '/') {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}
beforeEach(() => viewport(1280));
describe('application shell', () => {
  it('redirects the root to Dashboard and preserves safety context', async () => {
    const router = renderRoute();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Dashboard' }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe('/dashboard');
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByText(/not affiliated with ITO Health/i)).toBeVisible();
  });
  it('navigates through every page with correct active links and breadcrumbs', async () => {
    const user = userEvent.setup();
    renderRoute('/dashboard');
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    for (const item of navigation) {
      const link = within(nav).getByRole('link', { name: item.title });
      await user.click(link);
      expect(
        await screen.findByRole('heading', {
          level: 1,
          name:
            item.path === '/policies'
              ? 'Policy Comparison & Impact Analysis'
              : item.path === '/tasks'
                ? 'Care Coordination Tasks'
                : item.path === '/coverage'
                  ? 'Coverage & Renewals'
                  : item.title,
        }),
      ).toBeVisible();
      expect(link).toHaveAttribute('aria-current', 'page');
      expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
      expect(
        screen.getByRole('navigation', { name: 'Breadcrumb' }),
      ).toHaveTextContent(item.title);
    }
  });
  it('collapses and expands the desktop sidebar using the keyboard', async () => {
    const user = userEvent.setup();
    renderRoute('/dashboard');
    const toggle = screen.getByRole('button', { name: 'Collapse sidebar' });
    toggle.focus();
    await user.keyboard('{Enter}');
    expect(
      screen.getByRole('button', { name: 'Expand sidebar' }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('desktop-sidebar')).toHaveAttribute(
      'data-collapsed',
      'true',
    );
    await user.keyboard(' ');
    expect(
      screen.getByRole('button', { name: 'Collapse sidebar' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });
  it('defaults tablet navigation to collapsed', () => {
    viewport(900);
    renderRoute('/dashboard');
    expect(
      screen.getByRole('button', { name: 'Expand sidebar' }),
    ).toHaveAttribute('aria-expanded', 'false');
  });
  it('opens the mobile drawer, traps focus, and restores focus on Escape', async () => {
    viewport(390);
    const user = userEvent.setup();
    renderRoute('/dashboard');
    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', {
      name: 'Workspace navigation',
    });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    for (let index = 0; index < 12; index++) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  });
  it('closes the drawer after route navigation and on its close control', async () => {
    viewport(390);
    const user = userEvent.setup();
    renderRoute('/dashboard');
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('link', {
        name: 'Patients',
      }),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Patients' }),
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    await user.click(screen.getByRole('button', { name: 'Close navigation' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });
  it('recovers from an unknown route', async () => {
    const user = userEvent.setup();
    renderRoute('/missing');
    expect(
      screen.getByRole('heading', { name: 'Page not found' }),
    ).toBeVisible();
    await user.click(screen.getByRole('link', { name: 'Return to Dashboard' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Dashboard' }),
    ).toBeVisible();
  });
  it('provides a skip-to-content link as the first keyboard stop', async () => {
    const user = userEvent.setup();
    renderRoute('/dashboard');
    await user.tab();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveFocus();
    expect(
      screen.getByRole('link', { name: 'Skip to content' }),
    ).toHaveAttribute('href', '#main-content');
  });
  it('keeps the mocked API working without a backend', async () => {
    const response = await fetch('/api/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});
