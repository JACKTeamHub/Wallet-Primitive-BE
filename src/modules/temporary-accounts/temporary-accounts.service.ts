import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { NombaService } from '@infrastructure/nomba/nomba.service';
import { CreateTempAccountDto } from './dto/create-temp-account.dto';
import { Prisma, TemporaryAccount } from '@generated/prisma/client';
import { randomUUID } from 'crypto';

@Injectable()
export class TemporaryAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nombaService: NombaService,
  ) {}

  async create(
    workspaceId: string,
    dto: CreateTempAccountDto,
  ): Promise<TemporaryAccount> {
    const expiresAt = new Date(Date.now() + dto.expiresInSeconds * 1000);

    const formattedExpiryDate = expiresAt
      .toISOString()
      .replace('T', ' ')
      .substring(0, 19);

    const accountRef = `tref_${randomUUID()}`;
    const rawAccountName = dto.accountName || 'Temporary Checkout';
    const sanitizedAccountName = rawAccountName
      .replace(/[^a-zA-Z0-9 ]/g, ' ') // replace special characters with space
      .replace(/\s+/g, ' ') // collapse multiple spaces
      .trim();

    const virtualAccount = await this.nombaService.createVirtualAccount(
      workspaceId,
      {
        accountRef,
        accountName: sanitizedAccountName,
        expectedAmount: dto.expectedAmount.toFixed(2),
        expiryDate: formattedExpiryDate,
      },
    );

    return this.prisma.temporaryAccount.create({
      data: {
        workspaceId,
        accountNumber: virtualAccount.bankAccountNumber,
        bankName: virtualAccount.bankName,
        expectedAmount: new Prisma.Decimal(dto.expectedAmount),
        expiresAt,
        status: 'ACTIVE',
      },
    });
  }

  async findOne(
    workspaceId: string,
    id: string,
  ): Promise<TemporaryAccount | null> {
    return this.prisma.temporaryAccount.findFirst({
      where: { id, workspaceId },
    });
  }

  async findAll(workspaceId: string): Promise<TemporaryAccount[]> {
    return this.prisma.temporaryAccount.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
