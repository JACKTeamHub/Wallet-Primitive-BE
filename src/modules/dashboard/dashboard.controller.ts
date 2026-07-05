import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '@shared/guards/api-key.guard';
import { WorkspaceId } from '@shared/decorators/workspace-id.decorator';
import { ApiTags, ApiHeader, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GetDashboardUseCase } from './use-cases/get-dashboard.use-case';

@ApiTags('dashboard')
@ApiHeader({
  name: 'x-api-key',
  description: 'Developer workspace API key',
  required: true,
})
@UseGuards(ApiKeyGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly getDashboardUseCase: GetDashboardUseCase) {}

  @Get()
  @ApiOperation({ summary: 'Get workspace dashboard analytics and recent activity' })
  @ApiResponse({ status: 200, description: 'Dashboard metrics retrieved successfully' })
  async getDashboard(@WorkspaceId() workspaceId: string) {
    return this.getDashboardUseCase.execute(workspaceId);
  }
}
