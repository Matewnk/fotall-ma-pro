import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentTenant } from '../auth/current-tenant.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedContext } from '../auth/types';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

// §2.1 : seul ADMIN gère les utilisateurs de son tenant. Jamais de
// LicenceActiveGuard : administrer les comptes reste possible même
// tenant bloqué (au même titre que la facturation), pour ne jamais
// empêcher un ADMIN de reprendre la main sur son équipe.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@CurrentTenant() context: AuthenticatedContext, @Body() dto: CreateUserDto) {
    return this.usersService.create(this.requireTenant(context), context.userId, dto);
  }

  @Get()
  list(@CurrentTenant() context: AuthenticatedContext) {
    return this.usersService.list(this.requireTenant(context));
  }

  @Patch(':id')
  update(
    @CurrentTenant() context: AuthenticatedContext,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(this.requireTenant(context), id, context.userId, dto);
  }

  // ADMIN peut réinitialiser le mot de passe de n'importe quel compte de
  // son tenant, y compris le sien (ex. "réinitialiser le mot de passe de
  // l'Admin").
  @Patch(':id/mot-de-passe')
  async resetMotDePasse(
    @CurrentTenant() context: AuthenticatedContext,
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    await this.usersService.resetMotDePasse(this.requireTenant(context), id, context.userId, dto);
    return { ok: true };
  }

  private requireTenant(context: AuthenticatedContext): string {
    if (!context.tenantId) {
      throw new ForbiddenException();
    }
    return context.tenantId;
  }
}
