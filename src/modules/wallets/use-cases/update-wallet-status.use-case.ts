import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { Wallet } from '@generated/prisma/client';
import { UpdateWalletStatusDto } from '../dto/update-wallet-status.dto';
import { AuditLogService } from '@shared/services/audit-log.service';

@Injectable()
export class UpdateWalletStatusUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async execute(
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
