import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TypeMouvementStock } from '../generated/tenant-client';
import { TenantPrismaFactory } from '../tenancy/tenant-prisma.factory';
import { CreateArticleStockDto } from './dto/create-article-stock.dto';
import { CreateMouvementStockDto } from './dto/create-mouvement-stock.dto';
import { UpdateArticleStockDto } from './dto/update-article-stock.dto';

export type ArticleStockAvecQuantite = {
  id: string;
  code: string;
  intitule: string;
  unite: string;
  seuil: number;
  icone: string | null;
  actif: boolean;
  createdAt: Date;
  updatedAt: Date;
  quantite: number;
  enAlerte: boolean;
};

// Niveau de stock jamais stocké comme compteur mutable : toujours dérivé
// en sommant MouvementStock.quantite (même principe que le solde de
// caisse, cash.service.ts#solde) — déterministe, indépendant de l'ordre
// d'arrivée des événements.
@Injectable()
export class StocksService {
  constructor(private readonly tenantPrisma: TenantPrismaFactory) {}

  async create(tenantId: string, dto: CreateArticleStockDto) {
    const client = this.tenantPrisma.forTenant(tenantId);
    try {
      return await client.articleStock.create({
        data: {
          code: dto.code,
          intitule: dto.intitule,
          unite: dto.unite,
          ...(dto.seuil !== undefined ? { seuil: dto.seuil } : {}),
          ...(dto.icone !== undefined ? { icone: dto.icone } : {}),
          ...(dto.actif !== undefined ? { actif: dto.actif } : {}),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`Le code ${dto.code} est déjà utilisé.`);
      }
      throw error;
    }
  }

  async list(tenantId: string, actif?: boolean): Promise<ArticleStockAvecQuantite[]> {
    const client = this.tenantPrisma.forTenant(tenantId);
    const where: Prisma.ArticleStockWhereInput = {};
    if (actif !== undefined) {
      where.actif = actif;
    }
    const [articles, agregats] = await Promise.all([
      client.articleStock.findMany({ where, orderBy: { code: 'asc' } }),
      client.mouvementStock.groupBy({ by: ['articleId'], _sum: { quantite: true } }),
    ]);
    const quantiteParArticle = new Map(
      agregats.map((entree) => [entree.articleId, entree._sum.quantite ?? 0]),
    );
    return articles.map((article) => {
      const quantite = quantiteParArticle.get(article.id) ?? 0;
      return { ...article, quantite, enAlerte: quantite <= article.seuil };
    });
  }

  async findById(tenantId: string, id: string): Promise<ArticleStockAvecQuantite> {
    const client = this.tenantPrisma.forTenant(tenantId);
    const article = await client.articleStock.findUnique({ where: { id } });
    if (!article) {
      throw new NotFoundException();
    }
    const agregat = await client.mouvementStock.aggregate({
      where: { articleId: id },
      _sum: { quantite: true },
    });
    const quantite = agregat._sum.quantite ?? 0;
    return { ...article, quantite, enAlerte: quantite <= article.seuil };
  }

  async update(tenantId: string, id: string, dto: UpdateArticleStockDto) {
    await this.findById(tenantId, id);
    return this.tenantPrisma.forTenant(tenantId).articleStock.update({ where: { id }, data: dto });
  }

  // La suppression est bloquée dès qu'un mouvement existe (contrainte de
  // clé étrangère, RESTRICT) : l'historique des mouvements ne doit jamais
  // être orphelin. Un article déjà utilisé se désactive (actif: false),
  // ne se supprime pas — seul un article jamais mouvementé peut l'être.
  async remove(tenantId: string, id: string): Promise<void> {
    const client = this.tenantPrisma.forTenant(tenantId);
    await this.findById(tenantId, id);
    const mouvementExistant = await client.mouvementStock.findFirst({
      where: { articleId: id },
    });
    if (mouvementExistant) {
      throw new ConflictException(
        'Cet article a déjà des mouvements enregistrés : désactivez-le plutôt que de le supprimer.',
      );
    }
    await client.articleStock.delete({ where: { id } });
  }

  async listMouvements(tenantId: string, articleId?: string) {
    const client = this.tenantPrisma.forTenant(tenantId);
    const where: Prisma.MouvementStockWhereInput = {};
    if (articleId !== undefined) {
      where.articleId = articleId;
    }
    return client.mouvementStock.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { article: { select: { code: true, intitule: true, unite: true } } },
    });
  }

  async enregistrerMouvement(
    tenantId: string,
    operateurId: string,
    articleId: string,
    dto: CreateMouvementStockDto,
  ) {
    const client = this.tenantPrisma.forTenant(tenantId);

    const existant = await client.mouvementStock.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existant) {
      return existant;
    }

    const article = await client.articleStock.findUnique({ where: { id: articleId } });
    if (!article) {
      throw new NotFoundException('Article introuvable.');
    }

    let quantiteSignee: number;
    if (dto.type === TypeMouvementStock.ENTREE) {
      quantiteSignee = dto.quantite;
    } else if (dto.type === TypeMouvementStock.SORTIE) {
      quantiteSignee = -dto.quantite;
    } else {
      if (!dto.direction) {
        throw new BadRequestException(
          'direction (HAUSSE ou BAISSE) est requise pour un ajustement.',
        );
      }
      quantiteSignee = dto.direction === 'HAUSSE' ? dto.quantite : -dto.quantite;
    }

    if (quantiteSignee < 0) {
      const agregat = await client.mouvementStock.aggregate({
        where: { articleId },
        _sum: { quantite: true },
      });
      const quantiteActuelle = agregat._sum.quantite ?? 0;
      if (quantiteActuelle + quantiteSignee < 0) {
        throw new BadRequestException(
          `Stock insuffisant : ${quantiteActuelle} ${article.unite} disponibles.`,
        );
      }
    }

    return client.mouvementStock.create({
      data: {
        articleId,
        type: dto.type,
        quantite: quantiteSignee,
        operateurId,
        idempotencyKey: dto.idempotencyKey,
        ...(dto.note !== undefined ? { note: dto.note } : {}),
      },
    });
  }
}
