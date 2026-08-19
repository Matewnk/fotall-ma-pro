import { Global, Module } from '@nestjs/common';
import { TenantPrismaFactory } from './tenant-prisma.factory';
import { TenantSchemaProvisioner } from './tenant-schema.provisioner';

@Global()
@Module({
  providers: [TenantSchemaProvisioner, TenantPrismaFactory],
  exports: [TenantSchemaProvisioner, TenantPrismaFactory],
})
export class TenancyModule {}
