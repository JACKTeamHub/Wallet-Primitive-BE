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
import { TemporaryAccountsService } from './temporary-accounts.service';
import { CreateTempAccountDto } from './dto/create-temp-account.dto';
import { TemporaryAccount } from '@generated/prisma/client';
import { ApiTags, ApiHeader, ApiOperation, ApiResponse } from '@nestjs/swagger';

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
    private readonly temporaryAccountsService: TemporaryAccountsService,
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
    return this.temporaryAccountsService.create(workspaceId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all temporary accounts in workspace' })
  async findAll(
    @WorkspaceId() workspaceId: string,
  ): Promise<TemporaryAccount[]> {
    return this.temporaryAccountsService.findAll(workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific temporary account details' })
  async findOne(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ): Promise<TemporaryAccount> {
    const tempAccount = await this.temporaryAccountsService.findOne(
      workspaceId,
      id,
    );
    if (!tempAccount) {
      throw new NotFoundException('Temporary checkout account not found');
    }
    return tempAccount;
  }
}
