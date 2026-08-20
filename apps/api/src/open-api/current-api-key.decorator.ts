import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ContexteApiKey } from './api-key.service';

export const CurrentApiKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ContexteApiKey => {
    const request = ctx.switchToHttp().getRequest<{ apiKeyContext: ContexteApiKey }>();
    return request.apiKeyContext;
  },
);
