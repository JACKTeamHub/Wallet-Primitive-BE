import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { Customer } from '@generated/prisma/client';

@Injectable()
export class FindAllCustomersUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(workspaceId: string): Promise<Customer[]> {
    return this.prisma.customer.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
