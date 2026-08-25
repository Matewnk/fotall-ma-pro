import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

// SVG volontairement exclu (peut embarquer du script — risque XSS si
// affiché tel quel) : seuls des formats raster inertes sont acceptés.
const EXTENSION_PAR_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export const MIME_LOGO_ACCEPTES = Object.keys(EXTENSION_PAR_MIME);

const LOGOS_DIR = join(process.cwd(), 'uploads', 'logos');

// Stockage disque local (aucun S3/MinIO dans la stack actuelle — voir
// échange décision utilisateur). Un logo par tenant, nommé uniquement
// d'après le tenantId issu du JWT (jamais une valeur cliente) : aucune
// traversée de chemin possible, isolation multi-tenant par construction.
@Injectable()
export class LogoStorageService {
  constructor(private readonly config: ConfigService) {
    mkdirSync(LOGOS_DIR, { recursive: true });
  }

  enregistrer(tenantId: string, file: Express.Multer.File): string {
    // Supprime toute variante précédente (extension différente si le
    // format a changé entre deux uploads) pour ne jamais laisser un
    // ancien fichier orphelin.
    for (const entree of readdirSync(LOGOS_DIR)) {
      if (entree.startsWith(`${tenantId}.`)) {
        unlinkSync(join(LOGOS_DIR, entree));
      }
    }

    const extension = EXTENSION_PAR_MIME[file.mimetype];
    const nomFichier = `${tenantId}.${extension}`;
    writeFileSync(join(LOGOS_DIR, nomFichier), file.buffer);

    const port = this.config.get<string>('API_PORT') ?? '3000';
    const base = this.config.get<string>('API_PUBLIC_URL') ?? `http://localhost:${port}`;
    // Cache-busting : un même tenant réutilise souvent le même nom de
    // fichier après un nouvel upload, le navigateur ne doit pas servir
    // l'ancienne image depuis son cache.
    return `${base}/uploads/logos/${nomFichier}?v=${Date.now()}`;
  }
}
