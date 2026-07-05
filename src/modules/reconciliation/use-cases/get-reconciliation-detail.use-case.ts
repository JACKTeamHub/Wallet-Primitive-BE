import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';

@Injectable()
export class GetReconciliationDetailUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(workspaceId: string, id: string) {
    const entry = await this.prisma.ledgerEntry.findFirst({
      where: {
        id,
        workspaceId,
        description: {
          contains: 'Reconciliation',
          mode: 'insensitive',
        },
      },
      include: {
        wallet: {
          include: {
            customer: true,
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException('Reconciliation record not found');
    }

    return entry;
  }
}
