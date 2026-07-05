import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { TemporaryAccount } from '@generated/prisma/client';

@Injectable()
export class FindAllTempAccountsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(workspaceId: string): Promise<TemporaryAccount[]> {
    return this.prisma.temporaryAccount.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
