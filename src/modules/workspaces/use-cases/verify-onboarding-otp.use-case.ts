import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { VerifyOtpDto } from '../dto/verify-otp.dto';
import { AuditLogService } from '@shared/services/audit-log.service';

@Injectable()
export class VerifyOnboardingOtpUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async execute(dto: VerifyOtpDto): Promise<{ message: string }> {
    const user = await this.prisma.developerUser.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new NotFoundException('Developer user not found');
    }

    if (user.verified) {
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
        verified: true,
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
}
