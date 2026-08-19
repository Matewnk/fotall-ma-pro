import { SetMetadata } from '@nestjs/common';

// A poser sur les endpoints d'écriture métier (007+). Aucune route n'utilise
// encore ce decorateur : aucune écriture métier n'existe pour l'instant
// (voir specs/004-licensing/spec.md, périmètre différé).
export const REQUIRE_ACTIVE_LICENCE_KEY = 'requireActiveLicence';
export const RequireActiveLicence = () => SetMetadata(REQUIRE_ACTIVE_LICENCE_KEY, true);
