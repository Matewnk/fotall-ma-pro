import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { validateSession } from './session-validation.util';
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
  //
  // Bloque toute route hors JwtLenientAuthGuard (auth/me,
  // PATCH /auth/mot-de-passe) tant que mustChangePassword est actif —
  // force l'ecran de changement obligatoire apres un reset SUPER_ADMIN,
  // cf. users.service.ts#resetMotDePasse.
  async validate(payload: JwtPayload): Promise<AuthenticatedContext> {
    const { user, ...context } = await validateSession(this.prisma, payload);
    if (user.mustChangePassword) {
      throw new ForbiddenException('Changement de mot de passe requis.');
    }
    return context;
  }
}
