import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { Prisma } from '@generated/prisma/client';
import { TransferDto } from '../dto/transfer.dto';
import { KYC_LIMITS } from '../../../shared/utils/kyc-limits.util';
import { AuditLogService } from '@shared/services/audit-log.service';
import { randomUUID } from 'crypto';

@Injectable()
export class TransferUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async execute(
    workspaceId: string,
    dto: TransferDto,
  ): Promise<{
    transactionGroupId: string;
    amount: number;
    senderWalletId: string;
    recipientWalletId: string;
    status: string;
    timestamp: Date;
  }> {
    if (dto.senderWalletId === dto.recipientWalletId) {
      throw new BadRequestException(
        'Sender and recipient wallets must be different',
      );
    }

    const transferAmount = new Prisma.Decimal(dto.amount);

    return this.prisma.$transaction(async (tx) => {
      const sender = await tx.wallet.findFirst({
        where: { id: dto.senderWalletId, workspaceId },
      });
      if (!sender) {
        throw new NotFoundException('Sender wallet not found');
      }

      const recipient = await tx.wallet.findFirst({
        where: { id: dto.recipientWalletId, workspaceId },
      });
      if (!recipient) {
        throw new NotFoundException('Recipient wallet not found');
      }

      if (sender.status !== 'ACTIVE') {
        throw new BadRequestException(
          `Sender wallet is ${sender.status.toLowerCase()}`,
        );
      }

      if (recipient.status !== 'ACTIVE') {
        throw new BadRequestException(
          `Recipient wallet is ${recipient.status.toLowerCase()}`,
        );
      }

      // Enforce KYC limits for the sender (spending limit check)
      const limits = KYC_LIMITS[sender.kycTier];
      if (transferAmount.gt(limits.singleTxLimit)) {
        throw new BadRequestException(
          `Transfer amount exceeds the single transaction limit of NGN ${limits.singleTxLimit.toFixed(2)} for ${sender.kycTier}`,
        );
      }

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const aggregate = await tx.ledgerEntry.aggregate({
        where: {
          walletId: sender.id,
          type: 'DEBIT',
          status: 'SUCCESS',
          createdAt: { gte: startOfDay },
        },
        _sum: { amount: true },
      });

      const dailySum = (aggregate._sum.amount || new Prisma.Decimal(0)).add(transferAmount);
      if (dailySum.gt(limits.dailyLimit)) {
        throw new BadRequestException(
          `Transfer exceeds your daily spending limit of NGN ${limits.dailyLimit.toFixed(2)} for ${sender.kycTier}`,
        );
      }

      if (sender.balance.lt(transferAmount)) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      const newSenderBalance = sender.balance.sub(transferAmount);
      const newRecipientBalance = recipient.balance.add(transferAmount);

      // 4. Update balances in database
      await tx.wallet.update({
        where: { id: sender.id },
        data: { balance: newSenderBalance },
      });

      await tx.wallet.update({
        where: { id: recipient.id },
        data: { balance: newRecipientBalance },
      });

      // 5. Generate links and IDs
      const transactionGroupId = randomUUID();
      const debitEntryId = randomUUID();
      const creditEntryId = randomUUID();

      // 6. Write double-entry ledger journals
      // A. Debit Leg
      await tx.ledgerEntry.create({
        data: {
          id: debitEntryId,
          walletId: sender.id,
          workspaceId,
          type: 'DEBIT',
          amount: transferAmount,
          runningBalance: newSenderBalance,
          description:
            dto.description || `Transfer to ${recipient.accountNumber}`,
          transactionGroupId,
          relatedLedgerEntryId: creditEntryId,
        },
      });

      // B. Credit Leg
      const creditLeg = await tx.ledgerEntry.create({
        data: {
          id: creditEntryId,
          walletId: recipient.id,
          workspaceId,
          type: 'CREDIT',
          amount: transferAmount,
          runningBalance: newRecipientBalance,
          description:
            dto.description || `Transfer from ${sender.accountNumber}`,
          transactionGroupId,
          relatedLedgerEntryId: debitEntryId,
        },
      });

      void this.audit.log({
        workspaceId,
        action: 'WALLET_TRANSFER_EXECUTED',
        entity: 'LedgerEntry',
        entityId: transactionGroupId,
        actor: 'DeveloperConsole',
        metadata: {
          senderWalletId: sender.id,
          recipientWalletId: recipient.id,
          amount: transferAmount.toNumber(),
        },
      });

      return {
        transactionGroupId,
        amount: dto.amount,
        senderWalletId: sender.id,
        recipientWalletId: recipient.id,
        status: 'SUCCESS',
        timestamp: creditLeg.createdAt,
      };
    });
  }
}
