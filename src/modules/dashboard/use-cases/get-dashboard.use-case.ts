import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';

@Injectable()
export class GetDashboardUseCase {
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
      recentLedgerEntries,
      walletStatusStats,
    ] = await Promise.all([
      this.prisma.customer.count({ where: { workspaceId } }),
      this.prisma.wallet.count({ where: { workspaceId } }),
      this.prisma.temporaryAccount.count({ where: { workspaceId } }),
      this.prisma.processedWebhook.count({ where: { workspaceId } }),
      this.prisma.ledgerEntry.aggregate({
        where: { workspaceId, type: 'CREDIT', status: 'SUCCESS' },
        _sum: { amount: true },
      }),
      this.prisma.ledgerEntry.aggregate({
        where: { workspaceId, type: 'DEBIT', status: 'SUCCESS' },
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
      this.prisma.ledgerEntry.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          wallet: {
            select: {
              accountNumber: true,
              customer: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.wallet.groupBy({
        by: ['status'],
        where: { workspaceId },
        _count: { _all: true },
      }),
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

    const statusCounts = {
      ACTIVE: 0,
      FROZEN: 0,
      CLOSED: 0,
      SUSPENDED: 0,
    };

    for (const stat of walletStatusStats) {
      if (stat.status in statusCounts) {
        statusCounts[stat.status as keyof typeof statusCounts] = stat._count._all;
      }
    }

    return {
      metrics: {
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
        walletStatusCounts: statusCounts,
      },
      recentActivity: recentLedgerEntries.map((entry) => ({
        id: entry.id,
        walletId: entry.walletId,
        accountNumber: entry.wallet?.accountNumber,
        customerName: entry.wallet?.customer?.name,
        type: entry.type,
        amount: entry.amount.toNumber(),
        runningBalance: entry.runningBalance.toNumber(),
        status: entry.status,
        description: entry.description,
        createdAt: entry.createdAt,
      })),
    };
  }
}
