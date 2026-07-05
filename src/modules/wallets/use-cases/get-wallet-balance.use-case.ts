import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { Prisma } from '@generated/prisma/client';

@Injectable()
export class GetWalletBalanceUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    workspaceId: string,
    walletId: string,
  ): Promise<{
    balance: Prisma.Decimal;
    accountNumber: string;
    bankName: string;
  }> {
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, workspaceId },
      select: { balance: true, accountNumber: true, bankName: true },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }
}
