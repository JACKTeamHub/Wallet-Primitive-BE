import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { Wallet } from '@generated/prisma/client';
import { UpdateKycDto } from '../dto/update-kyc.dto';
import { AuditLogService } from '@shared/services/audit-log.service';

@Injectable()
export class UpdateKycUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async execute(
    workspaceId: string,
    walletId: string,
    dto: UpdateKycDto,
  ): Promise<Wallet> {
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, workspaceId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    if (dto.kycTier === 'TIER_2' && !dto.bvn && !wallet.bvn) {
      throw new BadRequestException('BVN is required to upgrade to TIER_2');
    }

    if (dto.kycTier === 'TIER_3') {
      const hasBvn = dto.bvn || wallet.bvn;
      const hasNin = dto.nin || wallet.nin;
      if (!hasBvn || !hasNin) {
        throw new BadRequestException(
          'Both BVN and NIN are required to upgrade to TIER_3',
        );
      }
    }

    const updatedWallet = await this.prisma.wallet.update({
      where: { id: walletId },
      data: {
        kycTier: dto.kycTier,
        ...(dto.bvn && { bvn: dto.bvn }),
        ...(dto.nin && { nin: dto.nin }),
      },
    });

    void this.audit.log({
      workspaceId,
      action: 'WALLET_KYC_TIER_UPDATED',
      entity: 'Wallet',
      entityId: walletId,
      actor: 'DeveloperConsole',
      metadata: { newKycTier: dto.kycTier },
    });

    return updatedWallet;
  }
}
