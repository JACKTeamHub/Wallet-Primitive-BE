import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { Customer } from '@generated/prisma/client';

@Injectable()
export class FindOneCustomerUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(workspaceId: string, id: string): Promise<Customer | null> {
    return this.prisma.customer.findFirst({
      where: { workspaceId, id },
    });
  }
}
