import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { Customer } from '@generated/prisma/client';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(workspaceId: string, dto: CreateCustomerDto): Promise<Customer> {
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

  async findAll(workspaceId: string): Promise<Customer[]> {
    return this.prisma.customer.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(workspaceId: string, id: string): Promise<Customer | null> {
    return this.prisma.customer.findFirst({
      where: { workspaceId, id },
    });
  }
}
