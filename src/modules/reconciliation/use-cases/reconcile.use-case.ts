import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { NombaService } from '@infrastructure/nomba/nomba.service';
import { ReconcileDto } from '../dto/reconcile.dto';
import { Prisma } from '@generated/prisma/client';
import { randomUUID } from 'crypto';

@Injectable()
export class ReconcileUseCase {
  private readonly logger = new Logger(ReconcileUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nomba: NombaService,
  ) {}

  async execute(workspaceId: string, dto: ReconcileDto) {
    const { transactionId, action } = dto;

    this.logger.log(
      `[Reconciliation] Initiated lookup for Tx: ${transactionId}, Action: ${action}`,
    );

    const alreadyProcessed = await this.prisma.processedWebhook.findUnique({
      where: { eventRef: transactionId },
    });

    if (alreadyProcessed && action === 'CREDIT') {
      return {
        status: 'ALREADY_PROCESSED',
        message: 'This transaction was already credited and processed.',
        transactionId,
      };
    }

    const nombaTx = await this.nomba.lookupTransaction(
      workspaceId,
      transactionId,
    );
    if (nombaTx.status !== 'SUCCESS' || !nombaTx.aliasAccountNumber) {
      throw new BadRequestException(
        'Transaction could not be verified on Nomba. Ensure the transaction reference is correct and successful.',
      );
    }

    const amount = new Prisma.Decimal(nombaTx.amount);
    const accountNumber = nombaTx.aliasAccountNumber;

    const wallet = await this.prisma.wallet.findUnique({
      where: { accountNumber },
    });

    if (!wallet || wallet.workspaceId !== workspaceId) {
      throw new NotFoundException(
        'Matching virtual wallet not found in your workspace',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const freshWallet = await tx.wallet.findUnique({
        where: { id: wallet.id },
      });

      if (!freshWallet) {
        throw new NotFoundException('Wallet not found');
      }

      if (freshWallet.status !== 'ACTIVE') {
        throw new BadRequestException(
          `Target wallet is inactive (Status: ${freshWallet.status}). Cannot complete reconciliation.`,
        );
      }

      if (action === 'CREDIT') {
        const doubleCheckFlag = await tx.processedWebhook.findUnique({
          where: { eventRef: transactionId },
        });
        if (doubleCheckFlag) {
          return {
            status: 'ALREADY_PROCESSED',
            message:
              'This transaction was already processed by another worker.',
            transactionId,
          };
        }

        const newBalance = freshWallet.balance.add(amount);
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: newBalance },
        });

        await tx.processedWebhook.create({
          data: {
            eventRef: transactionId,
            workspaceId,
          },
        });

        // Write ledger
        const ledgerId = randomUUID();
        await tx.ledgerEntry.create({
          data: {
            id: ledgerId,
            walletId: wallet.id,
            workspaceId,
            type: 'CREDIT',
            amount,
            runningBalance: newBalance,
            description: `Reconciliation manual credit for reference: ${transactionId}`,
          },
        });

        return {
          status: 'RECONCILED',
          action: 'CREDIT',
          amount: amount.toNumber(),
          walletId: wallet.id,
          newBalance: newBalance.toNumber(),
        };
      } else {
        if (freshWallet.balance.lt(amount)) {
          throw new BadRequestException(
            'Sufficient balance not available in target wallet for refund',
          );
        }

        const newBalance = freshWallet.balance.sub(amount);
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: newBalance },
        });

        const ledgerId = randomUUID();
        await tx.ledgerEntry.create({
          data: {
            id: ledgerId,
            walletId: wallet.id,
            workspaceId,
            type: 'DEBIT',
            amount,
            runningBalance: newBalance,
            description: `Reconciliation refund debit for reference: ${transactionId}`,
          },
        });

        return {
          status: 'RECONCILED',
          action: 'REFUND',
          amount: amount.toNumber(),
          walletId: wallet.id,
          newBalance: newBalance.toNumber(),
        };
      }
    });
  }
}
