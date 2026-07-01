import { Controller, Post, Get, Body, UseGuards, Param } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { TransferDto } from './dto/transfer.dto';
import { ApiTags, ApiHeader, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiKeyGuard } from '@shared/guards/api-key.guard';
import { WorkspaceId } from '@shared/decorators/workspace-id.decorator';

@ApiTags('wallets')
@ApiHeader({
  name: 'x-api-key',
  description: 'Developer workspace API key',
  required: true,
})
@UseGuards(ApiKeyGuard)
@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a virtual wallet for a customer' })
  @ApiResponse({ status: 201, description: 'Wallet created successfully' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateWalletDto,
  ) {
    return this.walletsService.createWallet(workspaceId, dto);
  }

  @Post('transfer')
  @ApiOperation({ summary: 'Execute internal wallet-to-wallet transfer' })
  @ApiResponse({ status: 201, description: 'Transfer executed successfully' })
  @ApiResponse({ status: 400, description: 'Insufficient funds / Bad Request' })
  async transfer(@WorkspaceId() workspaceId: string, @Body() dto: TransferDto) {
    return this.walletsService.transfer(workspaceId, dto);
  }

  @Get(':id/balance')
  @ApiOperation({ summary: 'Get wallet balance' })
  async getBalance(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.walletsService.getWalletBalance(workspaceId, id);
  }

  @Get(':id/ledger')
  @ApiOperation({ summary: 'Get transaction history / ledger entries' })
  async getLedger(@WorkspaceId() workspaceId: string, @Param('id') id: string) {
    return this.walletsService.getWalletLedger(workspaceId, id);
  }
}
