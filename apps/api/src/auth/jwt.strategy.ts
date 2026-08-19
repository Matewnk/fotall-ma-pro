import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedContext, JwtPayload } from './types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // Le JWT prouve seulement qu'il a ete signe par le serveur ; l'appartenance
  // user -> tenant est toujours reverifiee en base a chaque requete, jamais
  // deduite du seul contenu du token.
  async validate(payload: JwtPayload): Promise<AuthenticatedContext> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || !user.actif) {
      throw new UnauthorizedException('Session invalide.');
    }

    if (user.tenantId !== payload.tenantId || user.role !== payload.role) {
      throw new UnauthorizedException('Session invalide.');
    }

    return { userId: user.id, tenantId: user.tenantId, role: user.role };
  }
}
