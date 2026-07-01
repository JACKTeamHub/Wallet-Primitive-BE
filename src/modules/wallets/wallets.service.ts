import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { NombaService } from '@infrastructure/nomba/nomba.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { TransferDto } from './dto/transfer.dto';
import { UpdateWalletStatusDto } from './dto/update-wallet-status.dto';
import { Prisma, Wallet, LedgerEntry } from '@generated/prisma/client';
import { randomUUID } from 'crypto';
import { AuditLogService } from '@shared/services/audit-log.service';


@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nombaService: NombaService,
    private readonly audit: AuditLogService,
  ) {}

  async createWallet(
    workspaceId: string,
    dto: CreateWalletDto,
  ): Promise<Wallet> {
    // 1. Verify customer exists and belongs to the workspace
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, workspaceId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found in this workspace');
    }

    // 2. Generate unique reference for Nomba call
    const accountRef = `wref_${randomUUID()}`;

    // 3. Request virtual account from Nomba
    const sanitizedAccountName = customer.name
      .replace(/[^a-zA-Z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const virtualAccount = await this.nombaService.createVirtualAccount(
      workspaceId,
      {
        accountRef,
        accountName: sanitizedAccountName,
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

  async getWalletBalance(
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

  async getWalletLedger(
    workspaceId: string,
    walletId: string,
  ): Promise<LedgerEntry[]> {
    // Confirm wallet exists
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

  async transfer(
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

  async updateWalletStatus(
    workspaceId: string,
    walletId: string,
    dto: UpdateWalletStatusDto,
  ): Promise<Wallet> {
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, workspaceId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const updatedWallet = await this.prisma.wallet.update({
      where: { id: walletId },
      data: { status: dto.status },
    });

    void this.audit.log({
      workspaceId,
      action: 'WALLET_STATUS_UPDATED',
      entity: 'Wallet',
      entityId: walletId,
      actor: 'DeveloperConsole',
      metadata: { newStatus: dto.status },
    });

    return updatedWallet;
  }
}
