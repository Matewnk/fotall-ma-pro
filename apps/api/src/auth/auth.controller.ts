import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CurrentTenant } from './current-tenant.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SuperAdminLoginDto } from './dto/super-admin-login.dto';
import { JwtLenientAuthGuard } from './jwt-lenient-auth.guard';
import { AuthenticatedContext } from './types';

// Anti brute-force (docs/production-checklist.md §19.1) : 5
// tentatives/minute/IP sur les deux routes de connexion — bien en-dessous
// du quota global de ThrottlerModule (100/min, app.module.ts), qui reste
// le plafond par défaut pour le reste de l'API.
const LIMITE_TENTATIVES_CONNEXION = { default: { limit: 5, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Throttle(LIMITE_TENTATIVES_CONNEXION)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
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
