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

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
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

    // 2. Hash password using SHA-256
    const passwordHash = crypto
      .createHash('sha256')
      .update(dto.password)
      .digest('hex');

    // 3. Create Workspace and DeveloperUser in a transaction
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

    // 2. Generate a secure random token prefixed with wp_live_
    const rawKey = `wp_live_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    // 3. Save key hash to database
    const keyRecord = await this.prisma.apiKey.create({
      data: {
        keyHash,
        name: dto.name,
        workspaceId,
      },
    });

    return {
      rawKey,
      name: keyRecord.name,
      createdAt: keyRecord.createdAt,
    };
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

    // 3. Upsert credentials
    return this.prisma.nombaCredential.upsert({
      where: { workspaceId },
      update: {
        clientId: encryptedClientId,
        clientSecret: encryptedClientSecret,
        accountId: encryptedAccountId,
      },
      create: {
        clientId: encryptedClientId,
        clientSecret: encryptedClientSecret,
        accountId: encryptedAccountId,
        workspaceId,
      },
    });
  }
}
