import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CurrentTenant } from './current-tenant.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SuperAdminLoginDto } from './dto/super-admin-login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
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

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentTenant() context: AuthenticatedContext) {
    return context;
  }
}
