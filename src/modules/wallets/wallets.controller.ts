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
import { CreateWalletDto } from './dto/create-wallet.dto';
import { TransferDto } from './dto/transfer.dto';
import { UpdateWalletStatusDto } from './dto/update-wallet-status.dto';
import { ApiTags, ApiHeader, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Wallet, LedgerEntry, Prisma } from '@generated/prisma/client';
import { LedgerQueryDto } from './dto/ledger-query.dto';
import { UpdateKycDto } from './dto/update-kyc.dto';
import { WalletQueryDto } from './dto/wallet-query.dto';
import { StatementQueryDto } from './dto/statement-query.dto';
import { PaginatedResult } from '@shared/utils/pagination.util';

// Import Use Cases
import { CreateWalletUseCase } from './use-cases/create-wallet.use-case';
import { GetWalletBalanceUseCase } from './use-cases/get-wallet-balance.use-case';
import { GetWalletLedgerUseCase } from './use-cases/get-wallet-ledger.use-case';
import { UpdateWalletStatusUseCase } from './use-cases/update-wallet-status.use-case';
import { TransferUseCase } from './use-cases/transfer.use-case';
import { GenerateStatementUseCase } from './use-cases/generate-statement.use-case';
import { GetStatementUseCase } from './use-cases/get-statement.use-case';
import { UpdateKycUseCase } from './use-cases/update-kyc.use-case';
import { ListWalletsUseCase } from './use-cases/list-wallets.use-case';
import { GetWalletDetailUseCase } from './use-cases/get-wallet-detail.use-case';

@ApiTags('wallets')
@ApiHeader({
  name: 'x-api-key',
  description: 'Developer workspace API key',
  required: true,
})
@UseGuards(ApiKeyGuard)
@Controller('wallets')
export class WalletsController {
  constructor(
    private readonly createWalletUseCase: CreateWalletUseCase,
    private readonly getWalletBalanceUseCase: GetWalletBalanceUseCase,
    private readonly getWalletLedgerUseCase: GetWalletLedgerUseCase,
    private readonly updateWalletStatusUseCase: UpdateWalletStatusUseCase,
    private readonly transferUseCase: TransferUseCase,
    private readonly generateStatementUseCase: GenerateStatementUseCase,
    private readonly getStatementUseCase: GetStatementUseCase,
    private readonly updateKycUseCase: UpdateKycUseCase,
    private readonly listWalletsUseCase: ListWalletsUseCase,
    private readonly getWalletDetailUseCase: GetWalletDetailUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a virtual wallet for a customer' })
  @ApiResponse({ status: 201, description: 'Wallet created successfully' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateWalletDto,
  ): Promise<Wallet> {
    return this.createWalletUseCase.execute(workspaceId, dto);
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
    return this.transferUseCase.execute(workspaceId, dto);
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
    return this.getWalletBalanceUseCase.execute(workspaceId, id);
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
    return this.getWalletLedgerUseCase.execute(workspaceId, id, query);
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
    return this.updateWalletStatusUseCase.execute(workspaceId, id, dto);
  }

  @Patch(':id/kyc')
  @ApiOperation({ summary: 'Upgrade wallet KYC tier (Requires API Key)' })
  @ApiResponse({ status: 200, description: 'KYC tier updated successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid KYC requirements (BVN/NIN missing)',
  })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async updateKyc(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateKycDto,
  ): Promise<Wallet> {
    return this.updateKycUseCase.execute(workspaceId, id, dto);
  }

  @Get(':id/statement')
  @ApiOperation({
    summary: 'Get wallet transaction statement summary and transactions in a date range',
  })
  @ApiResponse({
    status: 200,
    description: 'Statement retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async getStatement(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Query() query: StatementQueryDto,
  ) {
    const { wallet, ...statementData } = await this.getStatementUseCase.execute(
      workspaceId,
      id,
      query.startDate,
      query.endDate,
    );
    return statementData;
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
    const buffer = await this.generateStatementUseCase.execute(
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

  @Get()
  @ApiOperation({ summary: 'List all virtual wallets in the workspace' })
  @ApiResponse({ status: 200, description: 'Wallets list retrieved successfully' })
  async list(
    @WorkspaceId() workspaceId: string,
    @Query() query: WalletQueryDto,
  ): Promise<PaginatedResult<Wallet>> {
    return this.listWalletsUseCase.execute(workspaceId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific wallet details' })
  @ApiResponse({ status: 200, description: 'Wallet details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async getDetail(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.getWalletDetailUseCase.execute(workspaceId, id);
  }
}
