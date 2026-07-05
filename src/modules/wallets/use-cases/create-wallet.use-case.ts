import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { NombaService } from '@infrastructure/nomba/nomba.service';
import { CreateWalletDto } from '../dto/create-wallet.dto';
import { Wallet, Prisma } from '@generated/prisma/client';
import { randomUUID } from 'crypto';

@Injectable()
export class CreateWalletUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nombaService: NombaService,
  ) {}

  async execute(workspaceId: string, dto: CreateWalletDto): Promise<Wallet> {
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
}
