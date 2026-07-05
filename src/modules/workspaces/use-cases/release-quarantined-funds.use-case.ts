import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { AuditLogService } from '@shared/services/audit-log.service';

@Injectable()
export class ReleaseQuarantinedFundsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async execute(workspaceId: string, ledgerEntryId: string) {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.ledgerEntry.findFirst({
        where: { id: ledgerEntryId, workspaceId, status: 'QUARANTINED' },
      });

      if (!entry) {
        throw new NotFoundException('Quarantined ledger entry not found');
      }

      const wallet = await tx.wallet.findUnique({
        where: { id: entry.walletId },
      });

      if (!wallet) {
        throw new NotFoundException(
          'Target wallet for quarantined funds not found',
        );
      }

      if (wallet.status === 'FROZEN' || wallet.status === 'CLOSED') {
        throw new BadRequestException(
          'Cannot release quarantined funds to a frozen or closed wallet. Please activate the wallet first.',
        );
      }

      // 1. Credit target wallet balance
      const newBalance = wallet.balance.add(entry.amount);
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });

      // 2. Set ledger entry status to SUCCESS and update its running balance
      const updatedEntry = await tx.ledgerEntry.update({
        where: { id: ledgerEntryId },
        data: {
          status: 'SUCCESS',
          runningBalance: newBalance,
          description: `${entry.description || ''} (Released by Admin)`,
        },
      });

      // 3. Write audit log
      void this.audit.log({
        workspaceId,
        action: 'QUARANTINED_FUNDS_RELEASED',
        entity: 'LedgerEntry',
        entityId: ledgerEntryId,
        actor: 'DeveloperConsole',
        metadata: { amount: entry.amount.toNumber(), walletId: wallet.id },
      });

      return updatedEntry;
    });
  }
}
