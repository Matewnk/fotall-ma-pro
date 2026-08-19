import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedContext } from './types';

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedContext => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedContext }>();
    return request.user;
  },
);
