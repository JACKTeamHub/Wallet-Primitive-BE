import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { RegisterCredentialsDto } from '../dto/register-credentials.dto';
import { EncryptionService } from '@infrastructure/encryption/encryption.service';
import { NombaCredential } from '@generated/prisma/client';
import { AuditLogService } from '@shared/services/audit-log.service';

@Injectable()
export class RegisterCredentialsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly audit: AuditLogService,
  ) {}

  async execute(
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
