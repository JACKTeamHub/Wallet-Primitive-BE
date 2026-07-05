import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { ApiKeyGuard } from '@shared/guards/api-key.guard';
import { WorkspaceId } from '@shared/decorators/workspace-id.decorator';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { RenameCustomerDto } from './dto/rename-customer.dto';
import { ApiTags, ApiHeader, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Customer } from '@generated/prisma/client';
import { CreateCustomerUseCase } from './use-cases/create-customer.use-case';
import { FindAllCustomersUseCase } from './use-cases/find-all-customers.use-case';
import { FindOneCustomerUseCase } from './use-cases/find-one-customer.use-case';
import { RenameCustomerUseCase } from './use-cases/rename-customer.use-case';

@ApiTags('customers')
@ApiHeader({
  name: 'x-api-key',
  description: 'Developer workspace API key',
  required: true,
})
@UseGuards(ApiKeyGuard)
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly createCustomerUseCase: CreateCustomerUseCase,
    private readonly findAllCustomersUseCase: FindAllCustomersUseCase,
    private readonly findOneCustomerUseCase: FindOneCustomerUseCase,
    private readonly renameCustomerUseCase: RenameCustomerUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new customer' })
  @ApiResponse({ status: 201, description: 'Customer created successfully' })
  @ApiResponse({ status: 409, description: 'Customer already exists' })
  async create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateCustomerDto,
  ): Promise<Customer> {
    return this.createCustomerUseCase.execute(workspaceId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all customers in workspace' })
  async findAll(@WorkspaceId() workspaceId: string): Promise<Customer[]> {
    return this.findAllCustomersUseCase.execute(workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific customer details' })
  async findOne(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ): Promise<Customer> {
    const customer = await this.findOneCustomerUseCase.execute(workspaceId, id);
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }

  @Patch(':id/rename')
  @ApiOperation({ summary: 'Rename an existing customer (Requires API Key)' })
  @ApiResponse({ status: 200, description: 'Customer renamed successfully' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async rename(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Body() dto: RenameCustomerDto,
  ): Promise<Customer> {
    return this.renameCustomerUseCase.execute(workspaceId, id, dto);
  }
}
