import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';

@Injectable()
export class GetWorkspaceAnalyticsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const [
      totalCustomers,
      walletAccountsCount,
      tempAccountsCount,
      totalProcessedWebhooks,
      creditSum,
      debitSum,
      balanceSum,
      fundedCheckouts,
      ledgerTransactionCount,
    ] = await Promise.all([
      this.prisma.customer.count({ where: { workspaceId } }),
      this.prisma.wallet.count({ where: { workspaceId } }),
      this.prisma.temporaryAccount.count({ where: { workspaceId } }),
      this.prisma.processedWebhook.count({ where: { workspaceId } }),
      this.prisma.ledgerEntry.aggregate({
        where: { workspaceId, type: 'CREDIT' },
        _sum: { amount: true },
      }),
      this.prisma.ledgerEntry.aggregate({
        where: { workspaceId, type: 'DEBIT' },
        _sum: { amount: true },
      }),
      this.prisma.wallet.aggregate({
        where: { workspaceId },
        _sum: { balance: true },
      }),
      this.prisma.temporaryAccount.count({
        where: { workspaceId, status: 'FUNDED' },
      }),
      this.prisma.ledgerEntry.count({ where: { workspaceId } }),
    ]);

    const totalAccounts = walletAccountsCount + tempAccountsCount;
    const inboundVolume = creditSum._sum.amount
      ? creditSum._sum.amount.toNumber()
      : 0;
    const outboundVolume = debitSum._sum.amount
      ? debitSum._sum.amount.toNumber()
      : 0;
    const netLiquidity = balanceSum._sum.balance
      ? balanceSum._sum.balance.toNumber()
      : 0;
    const checkoutSuccessRate =
      tempAccountsCount > 0
        ? parseFloat(((fundedCheckouts / tempAccountsCount) * 100).toFixed(2))
        : 0;

    return {
      totalCustomers,
      totalAccounts,
      walletAccountsCount,
      tempAccountsCount,
      inboundVolume,
      outboundVolume,
      netLiquidity,
      totalProcessedWebhooks,
      checkoutSuccessRate,
      ledgerTransactionCount,
    };
  }
}
