import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { Prisma, LedgerEntry } from '@generated/prisma/client';
import { ReconciliationQueryDto } from '../dto/reconciliation-query.dto';
import {
  PaginatedResult,
  createPaginatedResponse,
} from '@shared/utils/pagination.util';

@Injectable()
export class ListReconciliationsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    workspaceId: string,
    query: ReconciliationQueryDto,
  ): Promise<PaginatedResult<LedgerEntry>> {
    const { page, limit, type, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.LedgerEntryWhereInput = {
      workspaceId,
      description: {
        contains: 'Reconciliation',
        mode: 'insensitive',
      },
      ...(type && { type }),
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
        include: {
          wallet: {
            select: {
              accountNumber: true,
              bankName: true,
              customer: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return createPaginatedResponse(data, total, page, limit);
  }
}
