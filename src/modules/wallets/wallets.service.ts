import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { TransferDto } from './dto/transfer.dto';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { NombaService } from '@infrastructure/nomba/nomba.service';

@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nombaService: NombaService,
  ) {}

  async createWallet(workspaceId: string, dto: CreateWalletDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, workspaceId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found in this workspace');
    }

    const accountRef = `wref_${randomUUID()}`;

    const virtualAccount = await this.nombaService.createVirtualAccount(
      workspaceId,
      {
        accountRef,
        accountName: customer.name,
        bvn: dto.bvn,
      },
    );

    // 4. Save Wallet to database
    return this.prisma.wallet.create({
      data: {
        workspaceId,
        customerId: customer.id,
        accountNumber: virtualAccount.bankAccountNumber,
        bankName: virtualAccount.bankName,
        balance: new Prisma.Decimal(0.0),
      },
    });
  }

  async getWalletBalance(workspaceId: string, walletId: string) {
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, workspaceId },
      select: { balance: true, accountNumber: true, bankName: true },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  async getWalletLedger(workspaceId: string, walletId: string) {
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, workspaceId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return this.prisma.ledgerEntry.findMany({
      where: { walletId, workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async transfer(workspaceId: string, dto: TransferDto) {
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

      if (sender.balance.lt(transferAmount)) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      const newSenderBalance = sender.balance.sub(transferAmount);
      const newRecipientBalance = recipient.balance.add(transferAmount);

      await tx.wallet.update({
        where: { id: sender.id },
        data: { balance: newSenderBalance },
      });

      await tx.wallet.update({
        where: { id: recipient.id },
        data: { balance: newRecipientBalance },
      });

      const transactionGroupId = randomUUID();
      const debitEntryId = randomUUID();
      const creditEntryId = randomUUID();

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
