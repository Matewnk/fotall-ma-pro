import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

// §20 "monitoring" : sonde de disponibilité réelle (readiness), pas
// seulement un "le processus répond" (liveness) — vérifie que la base
// control-plane est joignable, condition nécessaire pour servir toute
// requête. Utilisée par un load balancer/orchestrateur pour décider si
// l'instance doit recevoir du trafic.
@Controller('health')
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getHealth(): Promise<{ status: 'ok' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        detail: 'base de données injoignable',
      });
    }
    return { status: 'ok' };
  }
}
