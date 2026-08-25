import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentTenant } from './current-tenant.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SuperAdminLoginDto } from './dto/super-admin-login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthenticatedContext } from './types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

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
