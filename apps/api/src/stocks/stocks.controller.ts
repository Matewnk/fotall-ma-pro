import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentTenant } from '../auth/current-tenant.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedContext } from '../auth/types';
import { LicenceActiveGuard } from '../licence/licence-active.guard';
import { RequireActiveLicence } from '../licence/require-active-licence.decorator';
import { CreateArticleStockDto } from './dto/create-article-stock.dto';
import { CreateMouvementStockDto } from './dto/create-mouvement-stock.dto';
import { UpdateArticleStockDto } from './dto/update-article-stock.dto';
import { StocksService } from './stocks.service';

// Catalogue (créer/modifier/supprimer un article) réservé ADMIN, comme
// Service (cahier des charges §2.1). Lecture ouverte à CAISSIER/TECHNICIEN
// (besoin opérationnel de consulter les niveaux de stock). Mouvements
// (entrée/sortie/ajustement) ouverts à ADMIN + TECHNICIEN : le technicien
// consomme les consommables pendant le traitement des commandes.
@UseGuards(JwtAuthGuard, RolesGuard, LicenceActiveGuard)
@Controller('stocks/articles')
export class StocksController {
  constructor(private readonly stocksService: StocksService) {}

  @Roles(Role.ADMIN)
  @RequireActiveLicence()
  @Post()
  create(@CurrentTenant() context: AuthenticatedContext, @Body() dto: CreateArticleStockDto) {
    this.requireTenant(context);
    return this.stocksService.create(context.tenantId as string, dto);
  }

  @Roles(Role.ADMIN, Role.CAISSIER, Role.TECHNICIEN)
  @Get()
  list(@CurrentTenant() context: AuthenticatedContext, @Query('actif') actif?: string) {
    this.requireTenant(context);
    const filtre = actif === undefined ? undefined : actif === 'true';
    return this.stocksService.list(context.tenantId as string, filtre);
  }

  @Roles(Role.ADMIN, Role.CAISSIER, Role.TECHNICIEN)
  @Get('mouvements')
  listMouvements(
    @CurrentTenant() context: AuthenticatedContext,
    @Query('articleId') articleId?: string,
  ) {
    this.requireTenant(context);
    return this.stocksService.listMouvements(context.tenantId as string, articleId);
  }

  @Roles(Role.ADMIN, Role.CAISSIER, Role.TECHNICIEN)
  @Get(':id')
  findById(@CurrentTenant() context: AuthenticatedContext, @Param('id') id: string) {
    this.requireTenant(context);
    return this.stocksService.findById(context.tenantId as string, id);
  }

  @Roles(Role.ADMIN)
  @RequireActiveLicence()
  @Patch(':id')
  update(
    @CurrentTenant() context: AuthenticatedContext,
    @Param('id') id: string,
    @Body() dto: UpdateArticleStockDto,
  ) {
    this.requireTenant(context);
    return this.stocksService.update(context.tenantId as string, id, dto);
  }

  @Roles(Role.ADMIN)
  @RequireActiveLicence()
  @Delete(':id')
  async remove(@CurrentTenant() context: AuthenticatedContext, @Param('id') id: string) {
    this.requireTenant(context);
    await this.stocksService.remove(context.tenantId as string, id);
    return { ok: true };
  }

  @Roles(Role.ADMIN, Role.TECHNICIEN)
  @RequireActiveLicence()
  @Post(':id/mouvements')
  enregistrerMouvement(
    @CurrentTenant() context: AuthenticatedContext,
    @Param('id') id: string,
    @Body() dto: CreateMouvementStockDto,
  ) {
    this.requireTenant(context);
    return this.stocksService.enregistrerMouvement(
      context.tenantId as string,
      context.userId,
      id,
      dto,
    );
  }

  private requireTenant(context: AuthenticatedContext): void {
    if (!context.tenantId) {
      throw new ForbiddenException();
    }
  }
}
