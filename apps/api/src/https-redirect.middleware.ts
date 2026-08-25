// Interface structurelle minimale (comme ReponseBrute dans les
// controllers, voir tickets.controller.ts) : évite une dépendance à
// @types/express pour ce seul besoin.
type RequeteHttp = {
  secure: boolean;
  headers: Record<string, string | undefined>;
  originalUrl: string;
};
type ReponseRedirection = { redirect: (statut: number, url: string) => void };

// §19.1 "HTTPS" : la terminaison TLS elle-même se fait typiquement en
// amont (load balancer/reverse proxy, hors périmètre de ce dépôt) — ce
// middleware s'appuie sur l'en-tête X-Forwarded-Proto qu'un tel proxy
// pose de façon fiable, et redirige toute requête non chiffrée. N'agit
// qu'en production : le développement local (HTTP, sans proxy) ne doit
// jamais être bloqué.
export function creerMiddlewareHttps(environnement: string | undefined) {
  return (req: RequeteHttp, res: ReponseRedirection, next: () => void): void => {
    if (environnement !== 'production') {
      next();
      return;
    }
    const protocoleTransmis = req.headers['x-forwarded-proto'];
    if (req.secure || protocoleTransmis === 'https') {
      next();
      return;
    }
    res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
  };
}
