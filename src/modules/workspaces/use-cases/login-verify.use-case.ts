import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { VerifyOtpDto } from '../dto/verify-otp.dto';
import { ConfigService } from '@nestjs/config';
import { AuditLogService } from '@shared/services/audit-log.service';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class LoginVerifyUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly audit: AuditLogService,
  ) {}

  async execute(
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

    const jwtSecret = this.configService.get<string>('JWT_SECRET')!;
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
}
