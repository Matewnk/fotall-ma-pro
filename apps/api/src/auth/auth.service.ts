import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { LicenceService } from '../licence/licence.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantSchemaProvisioner } from '../tenancy/tenant-schema.provisioner';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SuperAdminLoginDto } from './dto/super-admin-login.dto';
import { JwtPayload } from './types';

const BCRYPT_ROUNDS = 12;

type SessionResult = {
  accessToken: string;
  // Absent uniquement pour une session SUPER_ADMIN (tenantId null par
  // construction, cf. loginSuperAdmin) : le frontend distingue les deux
  // (voir apps/web/src/lib/auth-context.tsx).
  tenant?: { id: string; nomPressing: string; sousDomaine: string };
  user: { id: string; email: string; role: Role };
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly schemaProvisioner: TenantSchemaProvisioner,
    private readonly licenceService: LicenceService,
    private readonly onboardingService: OnboardingService,
  ) {}

  async register(dto: RegisterDto): Promise<SessionResult> {
    const motDePasseHash = await bcrypt.hash(dto.motDePasse, BCRYPT_ROUNDS);

    let tenant: { id: string; nomPressing: string; sousDomaine: string };
    let user: { id: string; email: string; role: Role };

    try {
      ({ tenant, user } = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            nomPressing: dto.nomPressing,
            sousDomaine: dto.sousDomaine,
          },
        });

        const user = await tx.user.create({
          data: {
            tenantId: tenant.id,
            role: Role.ADMIN,
            email: dto.email,
            motDePasseHash,
          },
        });

        await this.licenceService.creerEssai(tx, tenant.id, tenant.plan);
        await this.onboardingService.initier(tx, tenant.id);

        return { tenant, user };
      }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ce sous-domaine ou cet email est déjà utilisé.');
      }
      throw error;
    }

    try {
      await this.schemaProvisioner.provision(tenant.id);
    } catch (error) {
      // Compensation : un tenant sans schema provisionne est inutilisable,
      // on ne le laisse pas trainer en control-plane.
      this.logger.error(
        `Echec provisioning schema pour tenant ${tenant.id}, rollback`,
        error as Error,
      );
      await this.prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
      await this.prisma.tenant.delete({ where: { id: tenant.id } }).catch(() => undefined);
      throw error;
    }

    return this.issueSession(
      tenant.id,
      tenant.nomPressing,
      tenant.sousDomaine,
      user.id,
      user.email,
      user.role,
    );
  }

  async login(dto: LoginDto): Promise<SessionResult> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { sousDomaine: dto.sousDomaine },
    });
    if (!tenant) {
      throw new UnauthorizedException('Identifiants invalides.');
    }

    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: dto.email } },
    });
    if (!user || !user.actif) {
      throw new UnauthorizedException('Identifiants invalides.');
    }

    const passwordValid = await bcrypt.compare(dto.motDePasse, user.motDePasseHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Identifiants invalides.');
    }

    return this.issueSession(
      tenant.id,
      tenant.nomPressing,
      tenant.sousDomaine,
      user.id,
      user.email,
      user.role,
    );
  }

  // §2.1/§13.6 : un SUPER_ADMIN n'a pas de sousDomaine (tenantId null par
  // construction) — le flux LoginDto (résolution du tenant par
  // sousDomaine) ne peut pas s'appliquer. Recherche directe par email
  // parmi les comptes tenantId=null, jamais via l'index unique
  // (tenantId, email) : Postgres traite chaque NULL comme distinct, cet
  // index ne garantit donc pas l'unicité entre comptes SUPER_ADMIN.
  async loginSuperAdmin(dto: SuperAdminLoginDto): Promise<SessionResult> {
    const user = await this.prisma.user.findFirst({
      where: { tenantId: null, email: dto.email, role: Role.SUPER_ADMIN },
    });
    if (!user || !user.actif) {
      throw new UnauthorizedException('Identifiants invalides.');
    }

    const passwordValid = await bcrypt.compare(dto.motDePasse, user.motDePasseHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Identifiants invalides.');
    }

    const payload: JwtPayload = { sub: user.id, tenantId: null, role: user.role };
    return {
      accessToken: this.jwt.sign(payload),
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  private issueSession(
    tenantId: string,
    nomPressing: string,
    sousDomaine: string,
    userId: string,
    email: string,
    role: Role,
  ): SessionResult {
    const payload: JwtPayload = { sub: userId, tenantId, role };
    return {
      accessToken: this.jwt.sign(payload),
      tenant: { id: tenantId, nomPressing, sousDomaine },
      user: { id: userId, email, role },
    };
  }
}
