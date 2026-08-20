// Contrat commun à tous les rapports (cahier des charges §10.1) : un
// tableau simple (en-têtes + lignes de valeurs primitives), avec un résumé
// optionnel. Cette forme unique sert à la fois de réponse JSON et de
// source pour les exports CSV/PDF (reports-export.util.ts) — aucune
// double représentation à maintenir par rapport.
export interface TableauRapport {
  colonnes: string[];
  lignes: (string | number)[][];
  resume?: Record<string, string | number>;
}
