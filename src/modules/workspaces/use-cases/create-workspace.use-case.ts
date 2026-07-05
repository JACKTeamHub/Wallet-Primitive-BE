import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { CreateWorkspaceDto } from '../dto/create-workspace.dto';
import { EmailService } from '@infrastructure/email/email.service';
import { AuditLogService } from '@shared/services/audit-log.service';
import * as crypto from 'crypto';

@Injectable()
export class CreateWorkspaceUseCase {
  private readonly logger = new Logger(CreateWorkspaceUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly audit: AuditLogService,
  ) {}

  async execute(dto: CreateWorkspaceDto): Promise<{
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
      if (existingUser.verified) {
        throw new ConflictException(
          'A developer user with this email already exists',
        );
      }

      // Self-healing: Update unverified user registration and trigger new OTP send
      const passwordHash = crypto
        .createHash('sha256')
        .update(dto.password)
        .digest('hex');

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

      this.logger.log(
        `[Signup OTP Retry] Regenerated OTP token for unverified user ${dto.email}: ${otp}`,
      );

      await this.prisma.developerUser.update({
        where: { id: existingUser.id },
        data: {
          passwordHash,
          otpCode: otp,
          otpExpiresAt,
        },
      });

      // Queue verification email via BullMQ
      await this.emailService.sendVerificationEmail(dto.email, otp);

      return {
        message:
          'Workspace registration updated. A new verification OTP has been sent to your email.',
        workspaceId: existingUser.workspaceId,
        workspaceName: dto.name,
        developerEmail: dto.email,
      };
    }

    const passwordHash = crypto
      .createHash('sha256')
      .update(dto.password)
      .digest('hex');

    // Generate 6-digit onboarding OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    this.logger.log(
      `[Signup OTP] Generated OTP token for ${dto.email}: ${otp}`,
    );

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
          verified: false,
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
}
