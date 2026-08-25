import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';

// Config JWT partagee entre AuthModule (sessions utilisateur) et
// LicenceModule (signature/rotation de cle_licence_jwt) : une seule
// definition, importee par les deux, pour ne jamais diverger sur le
// secret ou l'algorithme.
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '12h'),
        } as JwtSignOptions,
      }),
    }),
  ],
  exports: [JwtModule],
})
export class JwtConfigModule {}
