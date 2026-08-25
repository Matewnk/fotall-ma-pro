import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookSecretGuard } from './webhook-secret.guard';

function makeContext(headers: Record<string, string | undefined>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

describe('WebhookSecretGuard', () => {
  it('autorise quand le secret reçu correspond au secret configuré', () => {
    const guard = new WebhookSecretGuard(
      new ConfigService({ FACTURATION_WEBHOOK_SECRET: 's3cret' }),
    );
    expect(guard.canActivate(makeContext({ 'x-webhook-secret': 's3cret' }))).toBe(true);
  });

  it('refuse quand le secret reçu est incorrect', () => {
    const guard = new WebhookSecretGuard(
      new ConfigService({ FACTURATION_WEBHOOK_SECRET: 's3cret' }),
    );
    expect(() => guard.canActivate(makeContext({ 'x-webhook-secret': 'mauvais' }))).toThrow(
      ForbiddenException,
    );
  });

  it('refuse quand aucun secret n’est reçu', () => {
    const guard = new WebhookSecretGuard(
      new ConfigService({ FACTURATION_WEBHOOK_SECRET: 's3cret' }),
    );
    expect(() => guard.canActivate(makeContext({}))).toThrow(ForbiddenException);
  });

  it('refuse (fail-closed) quand le secret n’est pas configuré côté serveur', () => {
    const guard = new WebhookSecretGuard(new ConfigService({}));
    expect(() => guard.canActivate(makeContext({ 'x-webhook-secret': 'peu importe' }))).toThrow(
      ForbiddenException,
    );
  });
});
