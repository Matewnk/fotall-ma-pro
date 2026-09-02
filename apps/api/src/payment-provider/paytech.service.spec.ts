import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { PaytechService } from './paytech.service';

function makeService(dryRun: string): PaytechService {
  return new PaytechService(new ConfigService({ PAYTECH_DRY_RUN: dryRun }));
}

describe('PaytechService', () => {
  it('mode dry-run (par défaut) : simule une initiation sans appeler PayTech', async () => {
    const service = makeService('true');

    const resultat = await service.initierPaiement({
      referenceCommande: 'fac-1',
      montant: 79000,
      devise: 'XOF',
      itemName: 'Abonnement PRO',
    });

    expect(resultat.mode).toBe('DRY_RUN');
    expect(resultat.token).toMatch(/^[0-9a-f-]{36}$/);
    expect(resultat.redirectUrl).toContain(resultat.token);
  });

  it('deux initiations dry-run produisent des tokens distincts', async () => {
    const service = makeService('true');

    const premier = await service.initierPaiement({
      referenceCommande: 'fac-1',
      montant: 79000,
      devise: 'XOF',
      itemName: 'Abonnement PRO',
    });
    const second = await service.initierPaiement({
      referenceCommande: 'fac-1',
      montant: 79000,
      devise: 'XOF',
      itemName: 'Abonnement PRO',
    });

    expect(premier.token).not.toBe(second.token);
  });

  it('mode réel (PAYTECH_DRY_RUN=false) : rejette clairement, non implémenté', async () => {
    const service = makeService('false');

    await expect(
      service.initierPaiement({
        referenceCommande: 'fac-1',
        montant: 79000,
        devise: 'XOF',
        itemName: 'Abonnement PRO',
      }),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
