import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '@shared/guards/api-key.guard';
import { WorkspaceId } from '@shared/decorators/workspace-id.decorator';
import { ApiTags, ApiHeader, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ReconcileDto } from './dto/reconcile.dto';

// Import Use Cases
import { ReconcileUseCase } from './use-cases/reconcile.use-case';

@ApiTags('reconciliation')
@ApiHeader({
  name: 'x-api-key',
  description: 'Developer workspace API key',
  required: true,
})
@UseGuards(ApiKeyGuard)
@Controller('reconciliation')
export class ReconciliationController {
  constructor(private readonly reconcileUseCase: ReconcileUseCase) {}

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
}
