import { SetMetadata } from '@nestjs/common';
import type { Scope } from './api-key.constants';

export const REQUIRE_SCOPES_KEY = 'requireScopes';
export const RequireScopes = (...scopes: Scope[]) => SetMetadata(REQUIRE_SCOPES_KEY, scopes);
