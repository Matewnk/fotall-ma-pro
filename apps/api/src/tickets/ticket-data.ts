// Vue de rendu du ticket (cahier des charges §7) : ne persiste rien, une
// simple projection d'une Commande (009) existante + des infos du tenant
// (control-plane) au moment de l'impression/export.
export type TicketArticle = {
  intitule: string;
  quantite: number;
  tarifUnitaire: string;
  sousTotal: string;
};

export type TicketData = {
  numero: number;
  estProvisoire: boolean;
  nomPressing: string;
  adresseTenant: string | null;
  telephoneTenant: string | null;
  logoUrl: string | null;
  client: { nom: string; telephone: string };
  articles: TicketArticle[];
  sousTotal: string;
  remise: string;
  total: string;
  datePrevue: Date | null;
  modeLivraison: string;
  adresseLivraison: string | null;
  statut: string;
};
