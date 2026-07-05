import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { Prisma, Wallet } from '@generated/prisma/client';
import { WalletQueryDto } from '../dto/wallet-query.dto';
import {
  PaginatedResult,
  createPaginatedResponse,
} from '@shared/utils/pagination.util';

@Injectable()
export class ListWalletsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    workspaceId: string,
    query: WalletQueryDto,
  ): Promise<PaginatedResult<Wallet>> {
    const { page, limit, search, status } = query;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.WalletWhereInput = {
      workspaceId,
      ...(status && { status }),
      ...(search && {
        OR: [
          {
            accountNumber: {
              contains: search,
            },
          },
          {
            customer: {
              name: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
          {
            customer: {
              email: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      this.prisma.wallet.count({ where: whereClause }),
      this.prisma.wallet.findMany({
        where: whereClause,
        include: {
          customer: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return createPaginatedResponse(data, total, page, limit);
  }
}
