import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { Prisma, LedgerEntry } from '@generated/prisma/client';
import { LedgerQueryDto } from '../dto/ledger-query.dto';
import {
  PaginatedResult,
  createPaginatedResponse,
} from '@shared/utils/pagination.util';

@Injectable()
export class GetWalletLedgerUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    workspaceId: string,
    walletId: string,
    query: LedgerQueryDto,
  ): Promise<PaginatedResult<LedgerEntry>> {
    // Confirm wallet exists
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, workspaceId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const { page, limit, search, type, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.LedgerEntryWhereInput = {
      walletId,
      workspaceId,
      ...(type && { type }),
      ...(search && {
        description: {
          contains: search,
          mode: 'insensitive',
        },
      }),
      ...((startDate || endDate) && {
        createdAt: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) }),
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
