import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuditLogService } from '../../shared/services/audit-log.service';

@Global()
@Module({
  providers: [PrismaService, AuditLogService],
  exports: [PrismaService, AuditLogService],
})
export class PrismaModule {}
