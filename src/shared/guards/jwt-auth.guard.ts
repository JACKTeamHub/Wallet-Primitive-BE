import { PrismaService } from '@infrastructure/prisma/prisma.service';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedException('Invalid Authorization header format');
    }

    const token = parts[1];
    const jwtSecret = this.configService.get<string>('JWT_SECRET')!;

    try {
      const decoded = jwt.verify(token, jwtSecret) as any;

      const user = await this.prisma.developerUser.findUnique({
        where: { id: decoded.userId },
        include: { workspace: true },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (!user.verified) {
        throw new UnauthorizedException('Account not verified');
      }

      request.user = user;
      request.workspaceId = user.workspaceId;
      request.workspace = user.workspace;

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
