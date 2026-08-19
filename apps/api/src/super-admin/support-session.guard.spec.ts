import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SupportSessionGuard } from './support-session.guard';

function makeContext(user: { userId: string } | undefined, tenantId: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user, params: { id: tenantId } }) }),
  } as unknown as ExecutionContext;
}

describe('SupportSessionGuard', () => {
  it('autorise quand une session active existe', async () => {
    const supportSessions = { getActive: jest.fn().mockResolvedValue({ id: 'session-1' }) };
    const guard = new SupportSessionGuard(supportSessions as never);

    await expect(
      guard.canActivate(makeContext({ userId: 'super-admin-1' }, 'tenant-1')),
    ).resolves.toBe(true);
    expect(supportSessions.getActive).toHaveBeenCalledWith('tenant-1', 'super-admin-1');
  });

  it('refuse sans session active', async () => {
    const supportSessions = { getActive: jest.fn().mockResolvedValue(null) };
    const guard = new SupportSessionGuard(supportSessions as never);

    await expect(
      guard.canActivate(makeContext({ userId: 'super-admin-1' }, 'tenant-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuse sans utilisateur authentifié', async () => {
    const supportSessions = { getActive: jest.fn() };
    const guard = new SupportSessionGuard(supportSessions as never);

    await expect(guard.canActivate(makeContext(undefined, 'tenant-1'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(supportSessions.getActive).not.toHaveBeenCalled();
  });
});
