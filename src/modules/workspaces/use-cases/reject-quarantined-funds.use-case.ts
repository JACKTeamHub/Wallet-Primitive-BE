import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { AuditLogService } from '@shared/services/audit-log.service';

@Injectable()
export class RejectQuarantinedFundsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async execute(workspaceId: string, ledgerEntryId: string) {
    const entry = await this.prisma.ledgerEntry.findFirst({
      where: { id: ledgerEntryId, workspaceId, status: 'QUARANTINED' },
    });

    if (!entry) {
      throw new NotFoundException('Quarantined ledger entry not found');
    }

    const updatedEntry = await this.prisma.ledgerEntry.update({
      where: { id: ledgerEntryId },
      data: {
        status: 'FAILED',
        description: `${entry.description || ''} (Rejected by Admin)`,
      },
    });

    void this.audit.log({
      workspaceId,
      action: 'QUARANTINED_FUNDS_REJECTED',
      entity: 'LedgerEntry',
      entityId: ledgerEntryId,
      actor: 'DeveloperConsole',
      metadata: { amount: entry.amount.toNumber(), walletId: entry.walletId },
    });

    return updatedEntry;
  }
}
