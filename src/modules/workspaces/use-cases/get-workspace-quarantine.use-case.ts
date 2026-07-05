import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { LedgerQueryDto } from '../../wallets/dto/ledger-query.dto';
import {
  PaginatedResult,
  createPaginatedResponse,
} from '../../../shared/utils/pagination.util';
import { LedgerEntry, Prisma } from '@generated/prisma/client';

@Injectable()
export class GetWorkspaceQuarantineUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    workspaceId: string,
    query: LedgerQueryDto,
  ): Promise<PaginatedResult<LedgerEntry>> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const { page, limit, search } = query;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.LedgerEntryWhereInput = {
      workspaceId,
      status: 'QUARANTINED',
      ...(search && {
        description: {
          contains: search,
          mode: 'insensitive',
        },
      }),
    };

    const [total, data] = await Promise.all([
      this.prisma.ledgerEntry.count({ where: whereClause }),
      this.prisma.ledgerEntry.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return createPaginatedResponse(data, total, page, limit);
  }
}
