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
import { LedgerQueryDto } from './dto/ledger-query.dto';
import {
  PaginatedResult,
  createPaginatedResponse,
} from '../../shared/utils/pagination.util';
import PDFDocument from 'pdfkit';

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
    query: LedgerQueryDto,
  ): Promise<PaginatedResult<LedgerEntry>> {
    // Confirm wallet exists
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, workspaceId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const { page, limit, search, type, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.LedgerEntryWhereInput = {
      walletId,
      workspaceId,
      ...(type && { type }),
      ...(search && {
        description: {
          contains: search,
          mode: 'insensitive',
        },
      }),
      ...((startDate || endDate) && {
        createdAt: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) }),
        },
      }),
    };

    const [total, data] = await Promise.all([
      this.prisma.ledgerEntry.count({ where: whereClause }),
      this.prisma.ledgerEntry.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return createPaginatedResponse(data, total, page, limit);
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

  async getWalletStatementPdf(
    workspaceId: string,
    walletId: string,
    startDateStr?: string,
    endDateStr?: string,
  ): Promise<Buffer> {
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, workspaceId },
      include: { customer: true },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const startDate = startDateStr ? new Date(startDateStr) : new Date(0);
    const endDate = endDateStr ? new Date(endDateStr) : new Date();

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

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // --- Draw header ---
      doc
        .fillColor('#6366f1')
        .fontSize(24)
        .text('WALLET-PRIMITIVE', 50, 50)
        .fontSize(10)
        .fillColor('#6b7280')
        .text('Fintech Wallet Statement', 50, 80);

      doc
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .moveTo(50, 95)
        .lineTo(550, 95)
        .stroke();

      // --- Customer and account metadata ---
      doc
        .fillColor('#1f2937')
        .fontSize(12)
        .text('Account Holder:', 50, 115)
        .fontSize(11)
        .fillColor('#4b5563')
        .text(`Name: ${wallet.customer.name}`)
        .text(`Email: ${wallet.customer.email}`);

      doc
        .fillColor('#1f2937')
        .fontSize(12)
        .text('Wallet Information:', 300, 115)
        .fontSize(11)
        .fillColor('#4b5563')
        .text(`Bank Name: ${wallet.bankName}`)
        .text(`Account Number: ${wallet.accountNumber}`)
        .text(`Current Balance: NGN ${wallet.balance.toFixed(2)}`);

      doc
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .moveTo(50, 185)
        .lineTo(550, 185)
        .stroke();

      // --- Transaction Table Header ---
      doc
        .fillColor('#111827')
        .fontSize(11)
        .text('Date', 50, 205)
        .text('Description', 160, 205)
        .text('Type', 360, 205)
        .text('Amount', 420, 205)
        .text('Balance', 490, 205);

      doc
        .strokeColor('#9ca3af')
        .lineWidth(1)
        .moveTo(50, 220)
        .lineTo(550, 220)
        .stroke();

      // --- Transactions List ---
      let y = 230;
      doc.fillColor('#4b5563').fontSize(9);

      if (ledgerEntries.length === 0) {
        doc.text('No transactions found in the specified date range.', 50, y);
      } else {
        ledgerEntries.forEach((entry) => {
          const descriptionText = entry.description || 'No description';
          const desc =
            descriptionText.length > 30
              ? descriptionText.substring(0, 27) + '...'
              : descriptionText;
          const dateStr = entry.createdAt.toISOString().split('T')[0];
          const typeStr = entry.type;
          const amountStr = `NGN ${entry.amount.toFixed(2)}`;
          const balanceStr = `NGN ${entry.runningBalance.toFixed(2)}`;

          // Check page boundary
          if (y > 700) {
            doc.addPage();
            y = 50; // reset y on new page
            // redraw table headers
            doc
              .fillColor('#111827')
              .fontSize(11)
              .text('Date', 50, y)
              .text('Description', 160, y)
              .text('Type', 360, y)
              .text('Amount', 420, y)
              .text('Balance', 490, y);

            doc
              .strokeColor('#9ca3af')
              .lineWidth(1)
              .moveTo(50, y + 15)
              .lineTo(550, y + 15)
              .stroke();

            y += 25;
            doc.fillColor('#4b5563').fontSize(9);
          }

          doc
            .text(dateStr, 50, y)
            .text(desc, 160, y)
            .text(typeStr, 360, y)
            .text(amountStr, 420, y)
            .text(balanceStr, 490, y);

          y += 20;
        });
      }

      // --- Footer ---
      doc
        .fillColor('#9ca3af')
        .fontSize(8)
        .text(
          `Statement generated on ${new Date().toLocaleDateString()}`,
          50,
          750,
          { align: 'center' },
        );

      doc.end();
    });
  }
}
