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
      last7DaysEntries,
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
      this.prisma.ledgerEntry.findMany({
        where: {
          workspaceId,
          status: 'SUCCESS',
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          amount: true,
          type: true,
          createdAt: true,
        },
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

    // Build the 7-day activity series
    const activitySeries = Array.from({ length: 7 }).map((_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const dateStr = date.toISOString().slice(0, 10);
      return {
        day: dateStr,
        date: dateStr,
        credits: 0,
        debits: 0,
        value: 0,
        count: 0,
      };
    });

    for (const entry of last7DaysEntries) {
      const dateStr = entry.createdAt.toISOString().slice(0, 10);
      const point = activitySeries.find((p) => p.day === dateStr);
      if (point) {
        const amt = entry.amount.toNumber();
        point.count += 1;
        point.value += amt;
        if (entry.type === 'CREDIT') {
          point.credits += amt;
        } else {
          point.debits += amt;
        }
      }
    }

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
      activitySeries,
    };
  }
}
