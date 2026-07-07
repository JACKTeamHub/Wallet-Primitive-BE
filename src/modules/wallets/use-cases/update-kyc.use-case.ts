import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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

    const bvnToVerify = dto.bvn !== undefined ? dto.bvn : wallet.bvn;
    const ninToVerify = dto.nin !== undefined ? dto.nin : wallet.nin;

    if (dto.kycTier === 'TIER_2' || dto.kycTier === 'TIER_3') {
      if (!bvnToVerify || !ninToVerify) {
        throw new BadRequestException(
          'Both BVN and NIN are required for this KYC tier upgrade',
        );
      }
    }

    if (bvnToVerify) {
      const bvnRegex = /^\d{11}$/;
      if (!bvnRegex.test(bvnToVerify)) {
        throw new BadRequestException(
          'Invalid BVN format. Must be exactly 11 digits.',
        );
      }
    }

    if (ninToVerify) {
      const ninRegex = /^\d{11}$/;
      if (!ninRegex.test(ninToVerify)) {
        throw new BadRequestException(
          'Invalid NIN format. Must be exactly 11 digits.',
        );
      }
    }

    if (dto.kycTier === 'TIER_3') {
      if (!dto.proofOfAddress) {
        throw new BadRequestException(
          'Proof of Address document verification is required to upgrade to TIER_3',
        );
      }
    }

    const updatedWallet = await this.prisma.wallet.update({
      where: { id: walletId },
      data: {
        kycTier: dto.kycTier,
        bvn: dto.bvn !== undefined ? dto.bvn : wallet.bvn,
        nin: dto.nin !== undefined ? dto.nin : wallet.nin,
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
