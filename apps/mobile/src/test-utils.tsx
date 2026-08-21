import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { AuthProvider } from './lib/auth-context';

export function renderAvecProviders(element: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NavigationContainer>{element}</NavigationContainer>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export function reponseJson(corps: unknown, ok = true, status = ok ? 200 : 400) {
  return {
    ok,
    status,
    text: () => Promise.resolve(JSON.stringify(corps)),
  } as Response;
}
