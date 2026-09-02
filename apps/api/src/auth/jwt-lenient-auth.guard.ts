import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtLenientAuthGuard extends AuthGuard('jwt-lenient') {}
