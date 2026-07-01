import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { ApiKeyGuard } from '@shared/guards/api-key.guard';
import { WorkspaceId } from '@shared/decorators/workspace-id.decorator';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ApiTags, ApiHeader, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Customer } from '@generated/prisma/client';

@ApiTags('customers')
@ApiHeader({
  name: 'x-api-key',
  description: 'Developer workspace API key',
  required: true,
})
@UseGuards(ApiKeyGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new customer' })
  @ApiResponse({ status: 201, description: 'Customer created successfully' })
  @ApiResponse({ status: 409, description: 'Customer already exists' })
  async create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateCustomerDto,
  ): Promise<Customer> {
    return this.customersService.create(workspaceId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all customers in workspace' })
  async findAll(@WorkspaceId() workspaceId: string): Promise<Customer[]> {
    return this.customersService.findAll(workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific customer details' })
  async findOne(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ): Promise<Customer> {
    const customer = await this.customersService.findOne(workspaceId, id);
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }
}
