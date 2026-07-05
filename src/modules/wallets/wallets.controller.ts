import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  Param,
  Res,
  Query,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiKeyGuard } from '@shared/guards/api-key.guard';
import { WorkspaceId } from '@shared/decorators/workspace-id.decorator';
import { WalletsService } from './wallets.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { TransferDto } from './dto/transfer.dto';
import { UpdateWalletStatusDto } from './dto/update-wallet-status.dto';
import { ApiTags, ApiHeader, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Wallet, LedgerEntry, Prisma } from '@generated/prisma/client';
import { LedgerQueryDto } from './dto/ledger-query.dto';
import { PaginatedResult } from '../../shared/utils/pagination.util';

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
  ): Promise<Wallet> {
    return this.walletsService.createWallet(workspaceId, dto);
  }

  @Post('transfer')
  @ApiOperation({ summary: 'Execute internal wallet-to-wallet transfer' })
  @ApiResponse({ status: 201, description: 'Transfer executed successfully' })
  @ApiResponse({ status: 400, description: 'Insufficient funds / Bad Request' })
  async transfer(
    @WorkspaceId() workspaceId: string,
    @Body() dto: TransferDto,
  ): Promise<{
    transactionGroupId: string;
    amount: number;
    senderWalletId: string;
    recipientWalletId: string;
    status: string;
    timestamp: Date;
  }> {
    return this.walletsService.transfer(workspaceId, dto);
  }

  @Get(':id/balance')
  @ApiOperation({ summary: 'Get wallet balance' })
  async getBalance(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ): Promise<{
    balance: Prisma.Decimal;
    accountNumber: string;
    bankName: string;
  }> {
    return this.walletsService.getWalletBalance(workspaceId, id);
  }

  @Get(':id/ledger')
  @ApiOperation({
    summary:
      'Get transaction history / ledger entries with pagination and filters',
  })
  async getLedger(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Query() query: LedgerQueryDto,
  ): Promise<PaginatedResult<LedgerEntry>> {
    return this.walletsService.getWalletLedger(workspaceId, id, query);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update wallet status (Freeze, suspend or activate)',
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet status updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async updateStatus(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWalletStatusDto,
  ): Promise<Wallet> {
    return this.walletsService.updateWalletStatus(workspaceId, id, dto);
  }

  @Get(':id/statement/pdf')
  @ApiOperation({
    summary: 'Generate wallet transaction statement PDF in a date range',
  })
  @ApiResponse({
    status: 200,
    description: 'PDF statement generated successfully',
  })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async getStatementPdf(
    @WorkspaceId() workspaceId: string,
    @Res() res: Response,
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<void> {
    const buffer = await this.walletsService.getWalletStatementPdf(
      workspaceId,
      id,
      startDate,
      endDate,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=statement-${id}.pdf`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }
}
