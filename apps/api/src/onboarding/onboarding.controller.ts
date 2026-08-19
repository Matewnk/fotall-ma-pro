import { Body, Controller, ForbiddenException, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentTenant } from '../auth/current-tenant.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedContext } from '../auth/types';
import { CompleteStep1Dto } from './dto/complete-step1.dto';
import { CompleteStep2Dto } from './dto/complete-step2.dto';
import { CompleteStep3Dto } from './dto/complete-step3.dto';
import { OnboardingService } from './onboarding.service';

// Reserve a l'ADMIN du tenant (« premier ADMIN », cahier des charges §12) :
// CAISSIER/TECHNICIEN/LIVREUR n'ont pas a piloter l'onboarding du pressing.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('etat')
  etat(@CurrentTenant() context: AuthenticatedContext) {
    this.requireTenant(context);
    return this.onboardingService.getEtat(context.tenantId as string);
  }

  @Post('etape-1')
  etape1(@CurrentTenant() context: AuthenticatedContext, @Body() dto: CompleteStep1Dto) {
    this.requireTenant(context);
    return this.onboardingService.completerEtape1(context.tenantId as string, dto);
  }

  @Post('etape-2')
  etape2(@CurrentTenant() context: AuthenticatedContext, @Body() dto: CompleteStep2Dto) {
    this.requireTenant(context);
    return this.onboardingService.completerEtape2(context.tenantId as string, dto);
  }

  @Post('etape-3')
  etape3(@CurrentTenant() context: AuthenticatedContext, @Body() dto: CompleteStep3Dto) {
    this.requireTenant(context);
    return this.onboardingService.completerEtape3(context.tenantId as string, dto);
  }

  private requireTenant(context: AuthenticatedContext): void {
    if (!context.tenantId) {
      throw new ForbiddenException();
    }
  }
}
