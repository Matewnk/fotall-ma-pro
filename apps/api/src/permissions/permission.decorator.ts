import { SetMetadata } from '@nestjs/common';
import { Permission } from './permissions.constants';

// A poser en complement de @Roles(...), jamais en remplacement : les deux
// guards s'appliquent en ET logique. @Roles filtre le rôle, @RequirePermission
// verifie ensuite le droit effectif (defaut du role + overrides ADMIN).
export const REQUIRE_PERMISSION_KEY = 'requirePermission';
export const RequirePermission = (permission: Permission) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);
