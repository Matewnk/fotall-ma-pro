import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './types';

const BCRYPT_ROUNDS = 12;

type SessionResult = {
  accessToken: string;
  tenant: { id: string; nomPressing: string; sousDomaine: string };
  user: { id: string; email: string; role: Role };
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<SessionResult> {
    const motDePasseHash = await bcrypt.hash(dto.motDePasse, BCRYPT_ROUNDS);

    try {
      const { tenant, user } = await this.prisma.$transaction(async (tx) => {
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

        return { tenant, user };
      });

      return this.issueSession(
        tenant.id,
        tenant.nomPressing,
        tenant.sousDomaine,
        user.id,
        user.email,
        user.role,
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ce sous-domaine ou cet email est déjà utilisé.');
      }
      throw error;
    }
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
