import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentTenant } from './current-tenant.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ExchangeGoogleCodeDto } from './dto/exchange-google-code.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterGoogleDto } from './dto/register-google.dto';
import { RegisterDto } from './dto/register.dto';
import { SuperAdminLoginDto } from './dto/super-admin-login.dto';
import { GoogleAuthGuard } from './google-auth.guard';
import { GoogleExchangeService } from './google-exchange.service';
import { JwtLenientAuthGuard } from './jwt-lenient-auth.guard';
import { AuthenticatedContext, GoogleProfile } from './types';

// Anti brute-force (docs/production-checklist.md §19.1) : 5
// tentatives/minute/IP sur les deux routes de connexion — bien en-dessous
// du quota global de ThrottlerModule (100/min, app.module.ts), qui reste
// le plafond par défaut pour le reste de l'API.
const LIMITE_TENTATIVES_CONNEXION = { default: { limit: 5, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleExchange: GoogleExchangeService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Throttle(LIMITE_TENTATIVES_CONNEXION)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // Declenche la redirection vers l'ecran de consentement Google — aucun
  // corps de handler necessaire, GoogleAuthGuard (passport) s'en charge.
  // GET (pas POST) : c'est une navigation de page complete, pas un appel
  // API classique.
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  demarrerGoogle() {}

  // Google redirige ici apres consentement. Jamais de JWT/token expose
  // dans l'URL de redirection vers le frontend (historique navigateur,
  // logs de proxy) : uniquement un code d'echange a usage unique et
  // courte duree (GoogleExchangeService), recupere ensuite via
  // POST /auth/google/exchange.
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  async callbackGoogle(@Req() req: Request, @Res() res: Response) {
    const webOrigin = this.config.get<string>('WEB_ORIGIN', 'http://localhost:5173');
    const profile = req.user as GoogleProfile | null;
    // Consentement refusé ou erreur Google (voir GoogleAuthGuard#handleRequest)
    // : req.user est null plutôt qu'une exception, pour toujours atterrir sur
    // une page du frontend au lieu d'un 401 JSON brut.
    if (!profile) {
      res.redirect(`${webOrigin}/inscription/google?erreur=google`);
      return;
    }
    try {
      const resultat = await this.authService.traiterProfilGoogle(profile);
      const code = this.googleExchange.creer(resultat);
      res.redirect(`${webOrigin}/inscription/google?code=${encodeURIComponent(code)}`);
    } catch {
      res.redirect(`${webOrigin}/inscription/google?erreur=google`);
    }
  }

  // Echange le code recu par le frontend apres la redirection Google
  // contre la session reelle (compte existant) ou le ticket a finaliser
  // (nouveau compte) — usage unique, voir GoogleExchangeService.
  @Post('google/exchange')
  exchangeGoogle(@Body() dto: ExchangeGoogleCodeDto) {
    const resultat = this.googleExchange.consommer(dto.code);
    if (!resultat) {
      throw new BadRequestException('Code invalide ou expiré, veuillez recommencer.');
    }
    return resultat;
  }

  // Finalise l'inscription d'un nouveau compte Google : nomPressing et
  // sousDomaine ne peuvent venir que du visiteur (Google ne les fournit
  // jamais) — email/prenom/nom viennent du ticket signe, jamais du body.
  @Post('register-google')
  registerGoogle(@Body() dto: RegisterGoogleDto) {
    return this.authService.finaliserInscriptionGoogle(dto.ticket, dto);
  }

  @Throttle(LIMITE_TENTATIVES_CONNEXION)
  @Post('super-admin/login')
  loginSuperAdmin(@Body() dto: SuperAdminLoginDto) {
    return this.authService.loginSuperAdmin(dto);
  }

  // JwtLenientAuthGuard (pas JwtAuthGuard) : doit rester accessible meme
  // quand mustChangePassword bloque le reste de l'API, sinon le frontend
  // ne peut plus savoir qui est connecte sur l'ecran de changement forcé.
  @UseGuards(JwtLenientAuthGuard)
  @Get('me')
  me(@CurrentTenant() context: AuthenticatedContext) {
    return context;
  }

  // Seul flux ou l'utilisateur prouve son mot de passe actuel (voir
  // AuthService#changerMotDePasse) — accessible meme si mustChangePassword
  // bloque le reste de l'API (JwtLenientAuthGuard), c'est justement la
  // route qui doit le lever.
  @UseGuards(JwtLenientAuthGuard)
  @Patch('mot-de-passe')
  changerMotDePasse(
    @CurrentTenant() context: AuthenticatedContext,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changerMotDePasse(context.userId, dto);
  }
}
