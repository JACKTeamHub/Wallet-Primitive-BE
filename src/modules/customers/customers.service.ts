import { Injectable, ConflictException } from '@nestjs/common';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { PrismaService } from '@infrastructure/prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(workspaceId: string, dto: CreateCustomerDto) {
    const existingCustomer = await this.prisma.customer.findUnique({
      where: {
        workspaceId_email: {
          workspaceId,
          email: dto.email,
        },
      },
    });

    if (existingCustomer) {
      throw new ConflictException(
        'Customer with this email already exists in this workspace',
      );
    }

    return this.prisma.customer.create({
      data: {
        workspaceId,
        email: dto.email,
        name: dto.name,
      },
    });
  }

  async findAll(workspaceId: string) {
    return this.prisma.customer.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(workspaceId: string, id: string) {
    return this.prisma.customer.findFirst({
      where: { workspaceId, id },
    });
  }
}
