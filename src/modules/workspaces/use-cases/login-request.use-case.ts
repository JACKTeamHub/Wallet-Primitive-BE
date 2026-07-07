import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { LoginDto } from '../dto/login.dto';
import { comparePassword } from '@shared/utils/hash.util';
import { ConfigService } from '@nestjs/config';
import { AuditLogService } from '@shared/services/audit-log.service';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class LoginRequestUseCase {
  private readonly logger = new Logger(LoginRequestUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly audit: AuditLogService,
  ) {}

  async execute(
    dto: LoginDto,
  ): Promise<{ access_token: string; workspaceId: string }> {
    const user = await this.prisma.developerUser.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!comparePassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.verified) {
      throw new UnauthorizedException(
        'Developer account is not active. Please verify your email first.',
      );
    }

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
