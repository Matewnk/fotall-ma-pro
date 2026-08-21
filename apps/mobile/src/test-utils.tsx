import type { ReactElement } from 'react';
import { AuthProvider } from './lib/auth-context';

export function renderAvecProviders(element: ReactElement) {
  return <AuthProvider>{element}</AuthProvider>;
}

export function reponseJson(corps: unknown, ok = true, status = ok ? 200 : 400) {
  return {
    ok,
    status,
    text: () => Promise.resolve(JSON.stringify(corps)),
  } as Response;
}
