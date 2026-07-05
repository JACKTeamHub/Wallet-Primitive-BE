import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { AuditLogService } from '@shared/services/audit-log.service';

@Injectable()
export class DeleteApiKeyUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async execute(workspaceId: string, keyId: string): Promise<void> {
    const key = await this.prisma.apiKey.findFirst({
      where: { id: keyId, workspaceId },
    });

    if (!key) {
      throw new NotFoundException('API Key not found');
    }

    await this.prisma.apiKey.delete({
      where: { id: keyId },
    });

    void this.audit.log({
      workspaceId,
      action: 'API_KEY_REVOKED',
      entity: 'ApiKey',
      entityId: keyId,
      actor: 'DeveloperConsole',
    });
  }
}
