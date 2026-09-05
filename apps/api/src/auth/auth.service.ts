import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { LicenceService } from '../licence/licence.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantSchemaProvisioner } from '../tenancy/tenant-schema.provisioner';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterGoogleDto } from './dto/register-google.dto';
import { RegisterDto } from './dto/register.dto';
import { SuperAdminLoginDto } from './dto/super-admin-login.dto';
import { GoogleProfile, GoogleTicketPayload, JwtPayload } from './types';

const BCRYPT_ROUNDS = 12;

type SessionResult = {
  accessToken: string;
  // Absent uniquement pour une session SUPER_ADMIN (tenantId null par
  // construction, cf. loginSuperAdmin) : le frontend distingue les deux
  // (voir apps/web/src/lib/auth-context.tsx).
  tenant?: { id: string; nomPressing: string; sousDomaine: string };
  user: { id: string; email: string; role: Role; mustChangePassword: boolean };
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
    return this.creerTenantEtAdmin({
      nomPressing: dto.nomPressing,
      sousDomaine: dto.sousDomaine,
      email: dto.email,
      motDePasseHash,
      prenom: dto.prenom,
      nom: dto.nom,
      pays: dto.pays,
    });
  }

  // Partagee entre l'inscription classique (register) et la finalisation
  // d'inscription Google (finaliserInscriptionGoogle) : les deux creent le
  // meme couple Tenant+ADMIN avec le meme essai/onboarding/provisioning de
  // schema — jamais une deuxieme logique de creation de tenant. Seule
  // difference entre les deux appelants : motDePasseHash est null et
  // googleId est fourni pour un compte cree via Google (jamais de mot de
  // passe Google stocke, meme hashe).
  private async creerTenantEtAdmin(data: {
    nomPressing: string;
    sousDomaine: string;
    email: string;
    motDePasseHash: string | null;
    prenom?: string | undefined;
    nom?: string | undefined;
    pays?: string | undefined;
    googleId?: string | undefined;
  }): Promise<SessionResult> {
    let tenant: { id: string; nomPressing: string; sousDomaine: string };
    let user: User;

    try {
      ({ tenant, user } = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            nomPressing: data.nomPressing,
            sousDomaine: data.sousDomaine,
            ...(data.pays ? { pays: data.pays } : {}),
          },
        });

        const user = await tx.user.create({
          data: {
            tenantId: tenant.id,
            role: Role.ADMIN,
            email: data.email,
            motDePasseHash: data.motDePasseHash,
            ...(data.prenom ? { prenom: data.prenom } : {}),
            ...(data.nom ? { nom: data.nom } : {}),
            ...(data.googleId ? { googleId: data.googleId } : {}),
          },
        });

        await this.licenceService.creerEssai(tx, tenant.id, tenant.plan);
        await this.onboardingService.initier(tx, tenant.id);

        return { tenant, user };
      }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // La cible du conflit distingue les deux causes possibles : email
        // n'entre en collision que dans de rares cas de concurrence (le
        // tenant venant d'être créé, [tenantId, email] ne peut pas déjà
        // contenir cet email) — sousDomaine (global, choisi par le
        // visiteur) est la cause pratiquement systématique.
        const cible = Array.isArray(error.meta?.target) ? (error.meta.target as string[]) : [];
        if (cible.some((champ) => champ.toLowerCase().includes('email'))) {
          throw new ConflictException('Cette adresse e-mail est déjà utilisée.');
        }
        throw new ConflictException('Ce sous-domaine est déjà utilisé.');
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

    return this.issueSession(tenant.id, tenant.nomPressing, tenant.sousDomaine, user);
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
    // motDePasseHash absent = compte cree via Google (jamais de mot de
    // passe local) — meme message generique que "mot de passe incorrect",
    // jamais une confirmation que le compte existe sous une autre forme.
    if (!user || !user.actif || !user.motDePasseHash) {
      throw new UnauthorizedException('Identifiants invalides.');
    }

    const passwordValid = await bcrypt.compare(dto.motDePasse, user.motDePasseHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Identifiants invalides.');
    }

    return this.issueSession(tenant.id, tenant.nomPressing, tenant.sousDomaine, user);
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
    if (!user || !user.actif || !user.motDePasseHash) {
      throw new UnauthorizedException('Identifiants invalides.');
    }

    const passwordValid = await bcrypt.compare(dto.motDePasse, user.motDePasseHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Identifiants invalides.');
    }

    const payload: JwtPayload = {
      sub: user.id,
      tenantId: null,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };
    return {
      accessToken: this.jwt.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  // Changement de mot de passe par l'utilisateur lui-meme (seul flux qui
  // exige la preuve du mot de passe actuel — contrairement aux resets
  // ADMIN/SUPER_ADMIN qui reposent sur l'autorite du role, cf.
  // users.service.ts#resetMotDePasse). Reemet un token a jour : le
  // tokenVersion incremente rend l'ancien token invalide immediatement,
  // donc la reponse doit fournir un nouveau accessToken pour ne pas
  // deconnecter l'utilisateur au moment meme ou il vient de resoudre
  // l'ecran de changement obligatoire.
  async changerMotDePasse(userId: string, dto: ChangePasswordDto): Promise<SessionResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Session invalide.');
    }
    // Un compte cree via Google n'a jamais de mot de passe local a
    // prouver — ce flux (preuve du mot de passe actuel) ne s'applique pas.
    if (!user.motDePasseHash) {
      throw new UnauthorizedException(
        'Ce compte utilise la connexion Google, aucun mot de passe local à changer.',
      );
    }

    const passwordValide = await bcrypt.compare(dto.motDePasseActuel, user.motDePasseHash);
    if (!passwordValide) {
      throw new UnauthorizedException('Mot de passe actuel incorrect.');
    }

    const motDePasseHash = await bcrypt.hash(dto.motDePasseNouveau, BCRYPT_ROUNDS);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        motDePasseHash,
        mustChangePassword: false,
        tokenVersion: { increment: 1 },
      },
    });

    if (!updated.tenantId) {
      const payload: JwtPayload = {
        sub: updated.id,
        tenantId: null,
        role: updated.role,
        tokenVersion: updated.tokenVersion,
      };
      return {
        accessToken: this.jwt.sign(payload),
        user: {
          id: updated.id,
          email: updated.email,
          role: updated.role,
          mustChangePassword: updated.mustChangePassword,
        },
      };
    }

    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: updated.tenantId } });
    return this.issueSession(tenant.id, tenant.nomPressing, tenant.sousDomaine, updated);
  }

  // Appele juste apres l'echange OAuth (google.strategy.ts) avec un profil
  // deja verifie par Google. googleId est la seule cle d'appartenance
  // fiable (voir schema.prisma#User.googleId) : si un compte Google
  // existant est retrouve, connexion directe. Sinon, ticket a finaliser
  // (nomPressing/sousDomaine restent a fournir, Google ne les connait pas).
  //
  // Choix deliberement documente : aucun rattachement automatique par
  // email a un compte classique existant. L'email n'est jamais une
  // identite globale dans ce systeme (@@unique([tenantId, email]),
  // plusieurs tenants peuvent deja legitimement partager un email) — un
  // rattachement par email creerait une exception a cette regle plutot
  // que de la respecter. Une nouvelle tentative "S'inscrire avec Google"
  // avec un email deja utilise par un tenant classique cree donc un
  // nouveau tenant distinct, exactement comme le ferait un deuxieme
  // register() classique avec le meme email.
  async traiterProfilGoogle(
    profile: GoogleProfile,
  ): Promise<{ type: 'session'; session: SessionResult } | { type: 'ticket'; ticket: string }> {
    const existant = await this.prisma.user.findUnique({ where: { googleId: profile.googleId } });

    if (existant) {
      if (!existant.actif) {
        throw new UnauthorizedException('Compte désactivé.');
      }
      if (!existant.tenantId) {
        // Aucun flux Google prevu pour un SUPER_ADMIN (perimetre
        // plateforme, hors tenant) — jamais atteint en pratique puisque
        // seuls creerTenantEtAdmin (role ADMIN) ecrit googleId.
        throw new UnauthorizedException('Connexion Google indisponible pour ce compte.');
      }
      const tenant = await this.prisma.tenant.findUniqueOrThrow({
        where: { id: existant.tenantId },
      });
      return {
        type: 'session',
        session: this.issueSession(tenant.id, tenant.nomPressing, tenant.sousDomaine, existant),
      };
    }

    const payload: GoogleTicketPayload = {
      purpose: 'google-signup',
      googleId: profile.googleId,
      email: profile.email,
      ...(profile.prenom ? { prenom: profile.prenom } : {}),
      ...(profile.nom ? { nom: profile.nom } : {}),
    };
    return { type: 'ticket', ticket: this.jwt.sign(payload, { expiresIn: '15m' }) };
  }

  private verifierTicketGoogle(ticket: string): GoogleTicketPayload {
    let decoded: unknown;
    try {
      decoded = this.jwt.verify(ticket);
    } catch {
      throw new UnauthorizedException('Session Google expirée, veuillez recommencer.');
    }
    if (
      !decoded ||
      typeof decoded !== 'object' ||
      (decoded as { purpose?: unknown }).purpose !== 'google-signup'
    ) {
      throw new UnauthorizedException('Session Google invalide.');
    }
    return decoded as GoogleTicketPayload;
  }

  async finaliserInscriptionGoogle(ticket: string, dto: RegisterGoogleDto): Promise<SessionResult> {
    const payload = this.verifierTicketGoogle(ticket);

    // Le compte a pu etre cree entre l'obtention du ticket et cette
    // finalisation (deux onglets, nouvelle tentative) — jamais un
    // doublon silencieux de tenant pour le meme compte Google.
    const existant = await this.prisma.user.findUnique({
      where: { googleId: payload.googleId },
    });
    if (existant) {
      throw new ConflictException('Ce compte Google est déjà associé à un pressing.');
    }

    return this.creerTenantEtAdmin({
      nomPressing: dto.nomPressing,
      sousDomaine: dto.sousDomaine,
      email: payload.email,
      motDePasseHash: null,
      prenom: payload.prenom,
      nom: payload.nom,
      pays: dto.pays,
      googleId: payload.googleId,
    });
  }

  private issueSession(
    tenantId: string,
    nomPressing: string,
    sousDomaine: string,
    user: User,
  ): SessionResult {
    const payload: JwtPayload = {
      sub: user.id,
      tenantId,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };
    return {
      accessToken: this.jwt.sign(payload),
      tenant: { id: tenantId, nomPressing, sousDomaine },
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }
}
