import { creerMiddlewareHttps } from './https-redirect.middleware';

function makeReqRes(
  overrides: Partial<{ secure: boolean; xForwardedProto: string; host: string }> = {},
) {
  const req = {
    secure: overrides.secure ?? false,
    headers: {
      host: overrides.host ?? 'exemple.dev',
      'x-forwarded-proto': overrides.xForwardedProto,
    },
    originalUrl: '/clients',
  };
  const res = { redirect: jest.fn() };
  return { req, res };
}

describe('creerMiddlewareHttps', () => {
  it('laisse passer toute requête en dehors de la production (dev local sans proxy)', () => {
    const middleware = creerMiddlewareHttps('development');
    const { req, res } = makeReqRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('laisse passer une requête déjà sécurisée en production', () => {
    const middleware = creerMiddlewareHttps('production');
    const { req, res } = makeReqRes({ secure: true });
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('laisse passer une requête transmise en HTTPS par le proxy (X-Forwarded-Proto)', () => {
    const middleware = creerMiddlewareHttps('production');
    const { req, res } = makeReqRes({ xForwardedProto: 'https' });
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('redirige une requête HTTP non sécurisée en production', () => {
    const middleware = creerMiddlewareHttps('production');
    const { req, res } = makeReqRes({ host: 'exemple.dev' });
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(308, 'https://exemple.dev/clients');
  });
});
