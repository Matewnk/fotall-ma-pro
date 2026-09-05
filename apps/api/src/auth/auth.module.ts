import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtConfigModule } from '../common/jwt-config.module';
import { LicenceModule } from '../licence/licence.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleExchangeService } from './google-exchange.service';
import { GoogleStrategy } from './google.strategy';
import { JwtLenientStrategy } from './jwt-lenient.strategy';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [PassportModule, LicenceModule, OnboardingModule, JwtConfigModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtLenientStrategy,
    GoogleStrategy,
    GoogleExchangeService,
    RolesGuard,
  ],
  exports: [AuthService, RolesGuard],
})
export class AuthModule {}
