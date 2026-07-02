import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { EncryptionService } from '@infrastructure/encryption/encryption.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { RegisterCredentialsDto } from './dto/register-credentials.dto';
import { GenerateApiKeyDto } from './dto/generate-api-key.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { LoginDto } from './dto/login.dto';
import { NombaCredential } from '@generated/prisma/client';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { AuditLogService } from '@shared/services/audit-log.service';
import { EmailService } from '@infrastructure/email/email.service';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly audit: AuditLogService,
    private readonly emailService: EmailService,
  ) {}

  async createWorkspace(dto: CreateWorkspaceDto): Promise<{
    message: string;
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

    // Generate 6-digit onboarding OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    const result = await this.prisma.$transaction(async (tx) => {
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
          isActive: false,
          otpCode: otp,
          otpExpiresAt,
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

    // Queue verification email via BullMQ
    await this.emailService.sendVerificationEmail(dto.email, otp);

    return {
      message:
        'Workspace registered successfully. A verification OTP has been sent to your email.',
      ...result,
    };
  }

  async verifyOnboardingOtp(dto: VerifyOtpDto): Promise<{ message: string }> {
    const user = await this.prisma.developerUser.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new NotFoundException('Developer user not found');
    }

    if (user.isActive) {
      throw new BadRequestException('Developer account is already verified');
    }

    if (
      !user.otpCode ||
      user.otpCode !== dto.otp ||
      !user.otpExpiresAt ||
      user.otpExpiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    await this.prisma.developerUser.update({
      where: { id: user.id },
      data: {
        isActive: true,
        otpCode: null,
        otpExpiresAt: null,
      },
    });

    void this.audit.log({
      workspaceId: user.workspaceId,
      action: 'DEVELOPER_ACTIVATED',
      entity: 'DeveloperUser',
      entityId: user.id,
      actor: user.email,
    });

    return {
      message: 'Developer account verified and activated successfully.',
    };
  }

  async loginRequest(dto: LoginDto): Promise<{ message: string }> {
    const user = await this.prisma.developerUser.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordHash = crypto
      .createHash('sha256')
      .update(dto.password)
      .digest('hex');

    if (user.passwordHash !== passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException(
        'Developer account is not active. Please verify your email first.',
      );
    }

    // Generate 6-digit login OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await this.prisma.developerUser.update({
      where: { id: user.id },
      data: {
        otpCode: otp,
        otpExpiresAt,
      },
    });

    // Queue OTP email via BullMQ
    await this.emailService.sendOtpEmail(user.email, otp);

    return { message: 'Security verification OTP sent to your email.' };
  }

  async loginVerify(
    dto: VerifyOtpDto,
  ): Promise<{ access_token: string; workspaceId: string }> {
    const user = await this.prisma.developerUser.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or OTP');
    }

    if (
      !user.otpCode ||
      user.otpCode !== dto.otp ||
      !user.otpExpiresAt ||
      user.otpExpiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Clear OTP
    await this.prisma.developerUser.update({
      where: { id: user.id },
      data: {
        otpCode: null,
        otpExpiresAt: null,
      },
    });

    const jwtSecret = process.env.JWT_SECRET || 'supersecretjwtkey12345';
    const access_token = jwt.sign(
      { userId: user.id, email: user.email, workspaceId: user.workspaceId },
      jwtSecret,
      { expiresIn: '1d' },
    );

    void this.audit.log({
      workspaceId: user.workspaceId,
      action: 'DEVELOPER_LOGIN',
      entity: 'DeveloperUser',
      entityId: user.id,
      actor: user.email,
    });

    return { access_token, workspaceId: user.workspaceId };
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

  async getWorkspaceAnalytics(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const [
      totalCustomers,
      walletAccountsCount,
      tempAccountsCount,
      totalProcessedWebhooks,
      creditSum,
      debitSum,
      balanceSum,
      fundedCheckouts,
      ledgerTransactionCount,
    ] = await Promise.all([
      this.prisma.customer.count({ where: { workspaceId } }),
      this.prisma.wallet.count({ where: { workspaceId } }),
      this.prisma.temporaryAccount.count({ where: { workspaceId } }),
      this.prisma.processedWebhook.count({ where: { workspaceId } }),
      this.prisma.ledgerEntry.aggregate({
        where: { workspaceId, type: 'CREDIT' },
        _sum: { amount: true },
      }),
      this.prisma.ledgerEntry.aggregate({
        where: { workspaceId, type: 'DEBIT' },
        _sum: { amount: true },
      }),
      this.prisma.wallet.aggregate({
        where: { workspaceId },
        _sum: { balance: true },
      }),
      this.prisma.temporaryAccount.count({
        where: { workspaceId, status: 'FUNDED' },
      }),
      this.prisma.ledgerEntry.count({ where: { workspaceId } }),
    ]);

    const totalAccounts = walletAccountsCount + tempAccountsCount;
    const inboundVolume = creditSum._sum.amount
      ? creditSum._sum.amount.toNumber()
      : 0;
    const outboundVolume = debitSum._sum.amount
      ? debitSum._sum.amount.toNumber()
      : 0;
    const netLiquidity = balanceSum._sum.balance
      ? balanceSum._sum.balance.toNumber()
      : 0;
    const checkoutSuccessRate =
      tempAccountsCount > 0
        ? parseFloat(((fundedCheckouts / tempAccountsCount) * 100).toFixed(2))
        : 0;

    return {
      totalCustomers,
      totalAccounts,
      walletAccountsCount,
      tempAccountsCount,
      inboundVolume,
      outboundVolume,
      netLiquidity,
      totalProcessedWebhooks,
      checkoutSuccessRate,
      ledgerTransactionCount,
    };
  }
}
