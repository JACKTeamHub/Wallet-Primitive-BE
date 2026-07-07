import { PrismaService } from '@infrastructure/prisma/prisma.service';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    const authHeader = request.headers['authorization'];

    // 1. Fallback to JWT if Authorization header is present
    if (authHeader && typeof authHeader === 'string') {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        const token = parts[1];
        const jwtSecret = this.configService.get<string>('JWT_SECRET');
        if (jwtSecret) {
          try {
            const decoded = jwt.verify(token, jwtSecret) as any;
            const user = await this.prisma.developerUser.findUnique({
              where: { id: decoded.userId },
              include: { workspace: true },
            });

            if (user && user.verified) {
              request.user = user;
              request.workspaceId = user.workspaceId;
              request.workspace = user.workspace;
              return true;
            }
          } catch {
            // Fall through to API key checks if JWT is invalid
          }
        }
      }
    }

    // 2. Programmatic API key check (x-api-key)
    if (!apiKey || typeof apiKey !== 'string') {
      throw new UnauthorizedException('Missing x-api-key or authorization header');
    }

    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const apiKeyRecord = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: { workspace: true },
    });

    if (!apiKeyRecord) {
      throw new UnauthorizedException('Invalid API Key');
    }

    request.workspaceId = apiKeyRecord.workspaceId;
    request.workspace = apiKeyRecord.workspace;

    return true;
  }
}
