import { ServiceUnavailableException } from '@nestjs/common';
import { AppController } from './app.controller';

function makePrismaMock() {
  return { $queryRaw: jest.fn() };
}

describe('AppController', () => {
  it('retourne status ok quand la base répond', async () => {
    const prisma = makePrismaMock();
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const controller = new AppController(prisma as never);

    await expect(controller.getHealth()).resolves.toEqual({ status: 'ok' });
  });

  it('lève ServiceUnavailableException quand la base est injoignable', async () => {
    const prisma = makePrismaMock();
    prisma.$queryRaw.mockRejectedValue(new Error('connexion refusée'));
    const controller = new AppController(prisma as never);

    await expect(controller.getHealth()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
