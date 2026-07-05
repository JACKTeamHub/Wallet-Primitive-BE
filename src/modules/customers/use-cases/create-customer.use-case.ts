import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { Customer } from '@generated/prisma/client';

@Injectable()
export class CreateCustomerUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    workspaceId: string,
    dto: CreateCustomerDto,
  ): Promise<Customer> {
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
}
