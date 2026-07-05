import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { Customer } from '@generated/prisma/client';
import { RenameCustomerDto } from '../dto/rename-customer.dto';
import { AuditLogService } from '@shared/services/audit-log.service';

@Injectable()
export class RenameCustomerUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async execute(
    workspaceId: string,
    customerId: string,
    dto: RenameCustomerDto,
  ): Promise<Customer> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, workspaceId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const updatedCustomer = await this.prisma.customer.update({
      where: { id: customerId },
      data: { name: dto.name },
    });

    void this.audit.log({
      workspaceId,
      action: 'CUSTOMER_RENAMED',
      entity: 'Customer',
      entityId: customerId,
      actor: 'DeveloperConsole',
      metadata: { oldName: customer.name, newName: dto.name },
    });

    return updatedCustomer;
  }
}
