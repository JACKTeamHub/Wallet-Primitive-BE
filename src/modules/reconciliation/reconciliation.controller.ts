import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Query,
  Param,
} from '@nestjs/common';
import { ApiKeyGuard } from '@shared/guards/api-key.guard';
import { WorkspaceId } from '@shared/decorators/workspace-id.decorator';
import { ApiTags, ApiHeader, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ReconcileDto } from './dto/reconcile.dto';
import { ReconciliationQueryDto } from './dto/reconciliation-query.dto';
import { PaginatedResult } from '@shared/utils/pagination.util';
import { LedgerEntry } from '@generated/prisma/client';

// Import Use Cases
import { ReconcileUseCase } from './use-cases/reconcile.use-case';
import { ListReconciliationsUseCase } from './use-cases/list-reconciliations.use-case';
import { GetReconciliationDetailUseCase } from './use-cases/get-reconciliation-detail.use-case';

@ApiTags('reconciliation')
@ApiHeader({
  name: 'x-api-key',
  description: 'Developer workspace API key',
  required: true,
})
@UseGuards(ApiKeyGuard)
@Controller('reconciliation')
export class ReconciliationController {
  constructor(
    private readonly reconcileUseCase: ReconcileUseCase,
    private readonly listReconciliationsUseCase: ListReconciliationsUseCase,
    private readonly getReconciliationDetailUseCase: GetReconciliationDetailUseCase,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Request manual transaction reconciliation or refund validation',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction successfully reconciled or refunded',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or Nomba lookup failed',
  })
  async reconcile(
    @WorkspaceId() workspaceId: string,
    @Body() dto: ReconcileDto,
  ) {
    return this.reconcileUseCase.execute(workspaceId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all reconciliation transaction entries' })
  @ApiResponse({
    status: 200,
    description: 'Reconciliation entries list retrieved successfully',
  })
  async list(
    @WorkspaceId() workspaceId: string,
    @Query() query: ReconciliationQueryDto,
  ): Promise<PaginatedResult<LedgerEntry>> {
    return this.listReconciliationsUseCase.execute(workspaceId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific reconciliation entry details' })
  @ApiResponse({
    status: 200,
    description: 'Reconciliation entry details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Reconciliation entry not found' })
  async getDetail(@WorkspaceId() workspaceId: string, @Param('id') id: string) {
    return this.getReconciliationDetailUseCase.execute(workspaceId, id);
  }
}
