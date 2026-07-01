import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    workspaceId: string;
    action: string;
    entity: string;
    entityId: string;
    actor: string;
    metadata?: any;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          workspaceId: params.workspaceId,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId,
          actor: params.actor,
          metadata: params.metadata || null,
        },
      });
    } catch (error: any) {
      // Fail-safe: log warning instead of throwing exception to prevent payment transaction crashes
      this.logger.warn(`Failed to write audit log: ${error.message}`);
    }
  }
}
