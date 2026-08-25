import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyGuard } from './api-key.guard';

function makeContext(headers: Record<string, string | undefined>) {
  const request: { headers: Record<string, string | undefined>; apiKeyContext?: unknown } = {
    headers,
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('ApiKeyGuard', () => {
  let apiKeyService: { verifierEtConsommerQuota: jest.Mock };
  let reflector: Reflector;
  let guard: ApiKeyGuard;

  beforeEach(() => {
    apiKeyService = { verifierEtConsommerQuota: jest.fn() };
    reflector = new Reflector();
    guard = new ApiKeyGuard(apiKeyService as never, reflector);
  });

  it('rejette une requête sans en-tête X-Api-Key', async () => {
    const { context } = makeContext({});
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(apiKeyService.verifierEtConsommerQuota).not.toHaveBeenCalled();
  });

  it('autorise une clé valide sans scope requis et expose le contexte sur la requête', async () => {
    const contexte = { tenantId: 'tenant-1', scopes: ['clients:read'], apiKeyId: 'key-1' };
    apiKeyService.verifierEtConsommerQuota.mockResolvedValue(contexte);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const { context, request } = makeContext({ 'x-api-key': 'fmp_live_abc' });
    const resultat = await guard.canActivate(context);

    expect(resultat).toBe(true);
    expect(request.apiKeyContext).toEqual(contexte);
  });

  it('autorise quand la clé possède le scope requis', async () => {
    apiKeyService.verifierEtConsommerQuota.mockResolvedValue({
      tenantId: 'tenant-1',
      scopes: ['clients:read', 'commandes:read'],
      apiKeyId: 'key-1',
    });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['commandes:read']);

    const { context } = makeContext({ 'x-api-key': 'fmp_live_abc' });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('refuse quand la clé ne possède pas le scope requis', async () => {
    apiKeyService.verifierEtConsommerQuota.mockResolvedValue({
      tenantId: 'tenant-1',
      scopes: ['clients:read'],
      apiKeyId: 'key-1',
    });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['commandes:read']);

    const { context } = makeContext({ 'x-api-key': 'fmp_live_abc' });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('propage le rejet du service (clé invalide, révoquée ou quota dépassé)', async () => {
    apiKeyService.verifierEtConsommerQuota.mockRejectedValue(
      new ForbiddenException('Clé API invalide ou révoquée.'),
    );

    const { context } = makeContext({ 'x-api-key': 'fmp_live_abc' });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
