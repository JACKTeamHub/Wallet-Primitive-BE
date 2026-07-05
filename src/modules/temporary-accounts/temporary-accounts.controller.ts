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
import { CreateTempAccountDto } from './dto/create-temp-account.dto';
import { TemporaryAccount } from '@generated/prisma/client';
import { ApiTags, ApiHeader, ApiOperation, ApiResponse } from '@nestjs/swagger';

// Import Use Cases
import { CreateTempAccountUseCase } from './use-cases/create-temp-account.use-case';
import { FindAllTempAccountsUseCase } from './use-cases/find-all-temp-accounts.use-case';
import { FindOneTempAccountUseCase } from './use-cases/find-one-temp-account.use-case';

@ApiTags('temporary-accounts')
@ApiHeader({
  name: 'x-api-key',
  description: 'Developer workspace API key',
  required: true,
})
@UseGuards(ApiKeyGuard)
@Controller('temporary-accounts')
export class TemporaryAccountsController {
  constructor(
    private readonly createTempAccountUseCase: CreateTempAccountUseCase,
    private readonly findAllTempAccountsUseCase: FindAllTempAccountsUseCase,
    private readonly findOneTempAccountUseCase: FindOneTempAccountUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a temporary checkout virtual account' })
  @ApiResponse({
    status: 201,
    description: 'Temporary account created successfully',
  })
  async create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateTempAccountDto,
  ): Promise<TemporaryAccount> {
    return this.createTempAccountUseCase.execute(workspaceId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all temporary accounts in workspace' })
  async findAll(
    @WorkspaceId() workspaceId: string,
  ): Promise<TemporaryAccount[]> {
    return this.findAllTempAccountsUseCase.execute(workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific temporary account details' })
  async findOne(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ): Promise<TemporaryAccount> {
    const tempAccount = await this.findOneTempAccountUseCase.execute(
      workspaceId,
      id,
    );
    if (!tempAccount) {
      throw new NotFoundException('Temporary checkout account not found');
    }
    return tempAccount;
  }
}
