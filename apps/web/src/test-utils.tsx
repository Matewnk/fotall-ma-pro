import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from './lib/auth-context';

export function renderAvecProviders(element: ReactElement, initialEntries: string[] = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    element: (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={initialEntries}>{element}</MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    ),
  };
}

export function reponseJson(corps: unknown, status = 200): Response {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
