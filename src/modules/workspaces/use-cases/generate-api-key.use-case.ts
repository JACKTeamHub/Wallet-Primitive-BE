import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { GenerateApiKeyDto } from '../dto/generate-api-key.dto';
import { AuditLogService } from '@shared/services/audit-log.service';
import * as crypto from 'crypto';

@Injectable()
export class GenerateApiKeyUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async execute(
    workspaceId: string,
    dto: GenerateApiKeyDto,
  ): Promise<{ rawKey: string; name: string; createdAt: Date }> {
    // Verify workspace exists
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const rawKey = `wp_live_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const keyRecord = await this.prisma.apiKey.create({
      data: {
        keyHash,
        name: dto.name,
        workspaceId,
      },
    });

    void this.audit.log({
      workspaceId,
      action: 'API_KEY_GENERATED',
      entity: 'ApiKey',
      entityId: keyRecord.id,
      actor: 'DeveloperConsole',
      metadata: { keyName: dto.name },
    });

    return {
      rawKey,
      name: keyRecord.name,
      createdAt: keyRecord.createdAt,
    };
  }
}
