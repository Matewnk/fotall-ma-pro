import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const BCRYPT_ROUNDS = 12;

export type UtilisateurPublic = {
  id: string;
  email: string;
  role: Role;
  actif: boolean;
  createdAt: Date;
};

function versPublic(user: {
  id: string;
  email: string;
  role: Role;
  actif: boolean;
  createdAt: Date;
}): UtilisateurPublic {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    actif: user.actif,
    createdAt: user.createdAt,
  };
}

// Gestion des utilisateurs d'un tenant (§2.1 : "ADMIN gère les
// utilisateurs"). Jamais de suppression : un compte désactivé
// (actif=false) conserve son historique d'audit/actorId dans les
// journaux existants (OperationCaisse.operateurId, AuditLog.actorId,
// ...) — supprimer casserait ces références.
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateUserDto): Promise<UtilisateurPublic> {
    const motDePasseHash = await bcrypt.hash(dto.motDePasse, BCRYPT_ROUNDS);
    try {
      const user = await this.prisma.user.create({
        data: { tenantId, email: dto.email, motDePasseHash, role: dto.role },
      });
      return versPublic(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Cet email est déjà utilisé dans ce tenant.');
      }
      throw error;
    }
  }

  async list(tenantId: string): Promise<UtilisateurPublic[]> {
    const users = await this.prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
    return users.map(versPublic);
  }

  async update(
    tenantId: string,
    id: string,
    actorId: string,
    dto: UpdateUserDto,
  ): Promise<UtilisateurPublic> {
    if (id === actorId && dto.actif === false) {
      throw new BadRequestException('Impossible de désactiver son propre compte.');
    }
    const existant = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!existant) {
      throw new NotFoundException();
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.actif !== undefined ? { actif: dto.actif } : {}),
      },
    });
    return versPublic(user);
  }
}
