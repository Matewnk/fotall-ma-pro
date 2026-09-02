import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { validateSession } from './session-validation.util';
import { AuthenticatedContext, JwtPayload } from './types';

// Variante de JwtStrategy sans le blocage mustChangePassword — reservee aux
// deux seules routes qu'un utilisateur en attente de changement doit
// pouvoir appeler : GET /auth/me et PATCH /auth/mot-de-passe (voir
// auth.controller.ts). Meme verification actif/tenantId/role/tokenVersion
// que JwtStrategy (validateSession partagee), jamais un mecanisme
// parallele.
@Injectable()
export class JwtLenientStrategy extends PassportStrategy(Strategy, 'jwt-lenient') {
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

  async validate(payload: JwtPayload): Promise<AuthenticatedContext> {
    const { userId, tenantId, role } = await validateSession(this.prisma, payload);
    return { userId, tenantId, role };
  }
}
