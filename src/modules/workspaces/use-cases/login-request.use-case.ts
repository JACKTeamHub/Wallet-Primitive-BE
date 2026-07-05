import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { LoginDto } from '../dto/login.dto';
import { EmailService } from '@infrastructure/email/email.service';
import * as crypto from 'crypto';

@Injectable()
export class LoginRequestUseCase {
  private readonly logger = new Logger(LoginRequestUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async execute(dto: LoginDto): Promise<{ message: string }> {
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

    if (!user.verified) {
      throw new UnauthorizedException(
        'Developer account is not active. Please verify your email first.',
      );
    }

    // Generate 6-digit login OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    this.logger.log(`[Login OTP] Generated OTP token for ${dto.email}: ${otp}`);

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
}
