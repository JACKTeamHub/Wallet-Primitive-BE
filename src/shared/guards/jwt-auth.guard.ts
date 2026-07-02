import { PrismaService } from '@infrastructure/prisma/prisma.service';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

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
    const jwtSecret = process.env.JWT_SECRET || 'supersecretjwtkey12345';

    try {
      const decoded = jwt.verify(token, jwtSecret) as {
        userId: string;
        email: string;
        workspaceId: string;
      };

      const user = await this.prisma.developerUser.findUnique({
        where: { id: decoded.userId },
        include: { workspace: true },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('Account not activated');
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
