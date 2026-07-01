import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { EncryptionService } from '@infrastructure/encryption/encryption.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { RegisterCredentialsDto } from './dto/register-credentials.dto';
import { GenerateApiKeyDto } from './dto/generate-api-key.dto';
import { NombaCredential } from '@generated/prisma/client';
import * as crypto from 'crypto';
import { AuditLogService } from '@shared/services/audit-log.service';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly audit: AuditLogService,
  ) {}

  async createWorkspace(dto: CreateWorkspaceDto): Promise<{
    workspaceId: string;
    workspaceName: string;
    developerEmail: string;
  }> {
    // 1. Verify email uniqueness
    const existingUser = await this.prisma.developerUser.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException(
        'A developer user with this email already exists',
      );
    }

    const passwordHash = crypto
      .createHash('sha256')
      .update(dto.password)
      .digest('hex');

    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: dto.name,
        },
      });

      const user = await tx.developerUser.create({
        data: {
          email: dto.email,
          passwordHash,
          workspaceId: workspace.id,
        },
      });

      void this.audit.log({
        workspaceId: workspace.id,
        action: 'WORKSPACE_CREATED',
        entity: 'Workspace',
        entityId: workspace.id,
        actor: user.email,
        metadata: { workspaceName: workspace.name },
      });

      return {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        developerEmail: user.email,
      };
    });
  }

  async generateApiKey(
    workspaceId: string,
    dto: GenerateApiKeyDto,
  ): Promise<{ rawKey: string; name: string; createdAt: Date }> {
    // 1. Verify workspace exists
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

  async getApiKeys(
    workspaceId: string,
  ): Promise<{ id: string; name: string; createdAt: Date }[]> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return this.prisma.apiKey.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteApiKey(workspaceId: string, keyId: string): Promise<void> {
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

  async registerCredentials(
    workspaceId: string,
    dto: RegisterCredentialsDto,
  ): Promise<NombaCredential> {
    // 1. Verify workspace exists
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // 2. Encrypt credentials using EncryptionService
    const encryptedClientId = this.encryption.encrypt(dto.clientId);
    const encryptedClientSecret = this.encryption.encrypt(dto.clientSecret);
    const encryptedAccountId = this.encryption.encrypt(dto.accountId);
    const encryptedSubAccountId = dto.subAccountId
      ? this.encryption.encrypt(dto.subAccountId)
      : null;

    const credentials = await this.prisma.nombaCredential.upsert({
      where: { workspaceId },
      update: {
        clientId: encryptedClientId,
        clientSecret: encryptedClientSecret,
        accountId: encryptedAccountId,
        subAccountId: encryptedSubAccountId,
      },
      create: {
        clientId: encryptedClientId,
        clientSecret: encryptedClientSecret,
        accountId: encryptedAccountId,
        subAccountId: encryptedSubAccountId,
        workspaceId,
      },
    });

    void this.audit.log({
      workspaceId,
      action: 'NOMBA_CREDENTIALS_UPDATED',
      entity: 'NombaCredential',
      entityId: credentials.id,
      actor: 'DeveloperConsole',
    });

    return credentials;
  }
}
