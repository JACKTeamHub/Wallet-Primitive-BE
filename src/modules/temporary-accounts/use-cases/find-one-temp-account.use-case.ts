import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { TemporaryAccount } from '@generated/prisma/client';

@Injectable()
export class FindOneTempAccountUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    workspaceId: string,
    id: string,
  ): Promise<TemporaryAccount | null> {
    return this.prisma.temporaryAccount.findFirst({
      where: { id, workspaceId },
    });
  }
}
