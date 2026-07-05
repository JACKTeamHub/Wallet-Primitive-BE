import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';

@Injectable()
export class GetStatementUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    workspaceId: string,
    walletId: string,
    startDateStr?: string,
    endDateStr?: string,
  ) {
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, workspaceId },
      include: { customer: true },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const startDate = startDateStr ? new Date(startDateStr) : new Date(0);
    const endDate = endDateStr ? new Date(endDateStr) : new Date();

    // 1. Fetch all ledger entries in range (for transactions list)
    const ledgerEntries = await this.prisma.ledgerEntry.findMany({
      where: {
        walletId,
        workspaceId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Fetch last success ledger entry before/at endDate for closingBalance
    const lastTxBeforeEnd = await this.prisma.ledgerEntry.findFirst({
      where: {
        walletId,
        workspaceId,
        status: 'SUCCESS',
        createdAt: { lte: endDate },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Fetch last success ledger entry before startDate for openingBalance
    const lastTxBeforeStart = await this.prisma.ledgerEntry.findFirst({
      where: {
        walletId,
        workspaceId,
        status: 'SUCCESS',
        createdAt: { lt: startDate },
      },
      orderBy: { createdAt: 'desc' },
    });

    const closingBalance = lastTxBeforeEnd ? Number(lastTxBeforeEnd.runningBalance) : 0;
    const openingBalance = lastTxBeforeStart ? Number(lastTxBeforeStart.runningBalance) : 0;

    const credits = ledgerEntries.filter(
      (entry) => entry.type === 'CREDIT' && entry.status === 'SUCCESS',
    ).length;

    const debits = ledgerEntries.filter(
      (entry) => entry.type === 'DEBIT' && entry.status === 'SUCCESS',
    ).length;

    const transactions = ledgerEntries.map((entry) => ({
      id: entry.id,
      walletId: entry.walletId,
      workspaceId: entry.workspaceId,
      type: entry.type,
      amount: Number(entry.amount),
      runningBalance: Number(entry.runningBalance),
      status: entry.status,
      nombaRef: entry.nombaRef,
      sessionId: entry.sessionId,
      description: entry.description,
      metadata: entry.metadata,
      createdAt: entry.createdAt,
      relatedLedgerEntryId: entry.relatedLedgerEntryId,
      transactionGroupId: entry.transactionGroupId,
    }));

    return {
      openingBalance,
      closingBalance,
      credits,
      debits,
      transactions,
      wallet,
    };
  }
}
