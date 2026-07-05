import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { AuditLogQueryDto } from '../dto/audit-log-query.dto';
import {
  PaginatedResult,
  createPaginatedResponse,
} from '../../../shared/utils/pagination.util';
import { AuditLog, Prisma } from '@generated/prisma/client';

@Injectable()
export class GetWorkspaceAuditLogsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    workspaceId: string,
    query: AuditLogQueryDto,
  ): Promise<PaginatedResult<AuditLog>> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const { page, limit, action, actor } = query;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.AuditLogWhereInput = {
      workspaceId,
      ...(action && { action }),
      ...(actor && { actor }),
    };

    const [total, data] = await Promise.all([
      this.prisma.auditLog.count({ where: whereClause }),
      this.prisma.auditLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return createPaginatedResponse(data, total, page, limit);
  }
}
