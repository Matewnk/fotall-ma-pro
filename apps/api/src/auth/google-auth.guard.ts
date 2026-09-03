import { ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';

// Refuse proprement (503, message clair) plutot que de laisser passport
// echouer silencieusement vers Google avec des identifiants factices
// ('not-configured', voir google.strategy.ts) quand GOOGLE_CLIENT_ID /
// GOOGLE_CLIENT_SECRET ne sont pas definis — dev/CI sans ces variables
// ne doit jamais planter au boot, mais un appel reel sur ces deux routes
// doit dire clairement pourquoi ca ne marche pas.
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(private readonly config: ConfigService) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    if (!this.config.get<string>('GOOGLE_CLIENT_ID') || !this.config.get<string>('GOOGLE_CLIENT_SECRET')) {
      throw new ServiceUnavailableException('Google OAuth non configuré.');
    }
    return super.canActivate(context);
  }

  // Ne jamais laisser passport lever une 401 brute sur GET
  // /auth/google/callback : c'est une navigation de page complète
  // (redirection depuis Google), pas un appel API — l'utilisateur doit
  // atterrir sur une page du frontend, jamais sur du JSON. Un consentement
  // refusé ou une erreur Google se traduit donc par request.user = null,
  // laissé au controller (voir AuthController#callbackGoogle) qui
  // redirige proprement vers le frontend avec un paramètre d'erreur.
  override handleRequest<TUser = unknown>(_err: unknown, user: TUser | false): TUser | null {
    return user ? user : null;
  }
}
