export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'CAISSIER' | 'TECHNICIEN' | 'LIVREUR';

export type TenantContext = {
  tenantId: string;
  userId?: string;
  role?: Role;
  supportSessionId?: string;
};
