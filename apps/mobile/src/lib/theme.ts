// Tokens portés de docs/design/DESIGN.md (même source que
// apps/web/src/index.css) : identité visuelle unique entre web et mobile,
// plutôt que les couleurs ad hoc utilisées jusqu'ici écran par écran
// (ex. #1e3a8a au lieu du bleu de marque réel #003c90).
export const couleurs = {
  surface: '#faf8ff',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f3f3fc',
  surfaceContainer: '#ededf6',
  surfaceContainerHigh: '#e7e7f1',
  onSurface: '#191b22',
  onSurfaceVariant: '#434653',
  outline: '#737784',
  outlineVariant: '#c3c6d5',
  primary: '#003c90',
  onPrimary: '#ffffff',
  primaryContainer: '#0f52ba',
  secondary: '#505f76',
  secondaryContainer: '#d0e1fb',
  onSecondaryContainer: '#54647a',
  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',
  background: '#faf8ff',
  onBackground: '#191b22',
  statutEnAttente: '#f59e0b',
  statutEnCours: '#3b82f6',
  statutTermine: '#10b981',
  statutLivre: '#6366f1',
  alerteCritique: '#ef4444',
} as const;

export const rayon = {
  sm: 2,
  base: 4,
  md: 6,
  lg: 8,
  xl: 12,
  full: 9999,
} as const;

export const espacement = {
  base: 8,
  gutter: 16,
  margeMobile: 16,
} as const;

export const typographie = {
  headlineLg: { fontSize: 24, fontWeight: '600' as const, lineHeight: 30 },
  headlineMd: { fontSize: 20, fontWeight: '600' as const, lineHeight: 26 },
  bodyMd: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  labelCaps: {
    fontSize: 12,
    fontWeight: '700' as const,
    lineHeight: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  kpiDisplay: { fontSize: 32, fontWeight: '700' as const, lineHeight: 38 },
};
