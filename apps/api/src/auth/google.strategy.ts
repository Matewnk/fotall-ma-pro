import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { GoogleProfile } from './types';

// Volontairement sans getOrThrow ici (contrairement a JWT_SECRET,
// jwt-config.module.ts) : des valeurs par defaut inertes permettent a
// l'app de demarrer meme sans identifiants Google configures (dev/CI qui
// n'en ont pas) — GET /auth/google echouerait alors proprement au premier
// appel plutot que de faire planter tout le boot de l'API pour une
// fonctionnalite optionnelle. Jamais de secret en dur : uniquement des
// variables d'environnement, jamais commit dans le code.
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      // "|| " (pas la valeur par defaut de ConfigService#get) : une variable
      // presente mais vide dans .env (GOOGLE_CLIENT_ID= sans valeur, cas
      // courant en dev/CI avant configuration reelle) doit aussi retomber
      // sur le placeholder, sinon OAuth2Strategy leve une exception
      // synchrone au demarrage ("requires a clientID option").
      clientID: config.get<string>('GOOGLE_CLIENT_ID') || 'not-configured',
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET') || 'not-configured',
      callbackURL:
        config.get<string>('GOOGLE_CALLBACK_URL') || 'http://localhost:3000/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error('Aucune adresse email fournie par Google.'));
      return;
    }
    const resultat: GoogleProfile = {
      googleId: profile.id,
      email,
      ...(profile.name?.givenName ? { prenom: profile.name.givenName } : {}),
      ...(profile.name?.familyName ? { nom: profile.name.familyName } : {}),
    };
    done(null, resultat);
  }
}
