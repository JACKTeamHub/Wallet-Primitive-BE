import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Query,
} from '@nestjs/common';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { RegisterCredentialsDto } from './dto/register-credentials.dto';
import { GenerateApiKeyDto } from './dto/generate-api-key.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { LoginDto } from './dto/login.dto';
import { SimulateWebhookDto } from './dto/simulate-webhook.dto';
import { LedgerQueryDto } from '../wallets/dto/ledger-query.dto';
import { NombaCredential, AuditLog, LedgerEntry } from '@generated/prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { PaginatedResult } from '@shared/utils/pagination.util';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

// Import Use Cases
import { CreateWorkspaceUseCase } from './use-cases/create-workspace.use-case';
import { VerifyOnboardingOtpUseCase } from './use-cases/verify-onboarding-otp.use-case';
import { LoginRequestUseCase } from './use-cases/login-request.use-case';
import { LoginVerifyUseCase } from './use-cases/login-verify.use-case';
import { GenerateApiKeyUseCase } from './use-cases/generate-api-key.use-case';
import { GetApiKeysUseCase } from './use-cases/get-api-keys.use-case';
import { DeleteApiKeyUseCase } from './use-cases/delete-api-key.use-case';
import { RegisterCredentialsUseCase } from './use-cases/register-credentials.use-case';
import { GetWorkspaceAnalyticsUseCase } from './use-cases/get-workspace-analytics.use-case';
import { GetWorkspaceAuditLogsUseCase } from './use-cases/get-workspace-audit-logs.use-case';
import { SimulateWebhookUseCase } from './use-cases/simulate-webhook.use-case';
import { GetWorkspaceQuarantineUseCase } from './use-cases/get-workspace-quarantine.use-case';
import { ReleaseQuarantinedFundsUseCase } from './use-cases/release-quarantined-funds.use-case';
import { RejectQuarantinedFundsUseCase } from './use-cases/reject-quarantined-funds.use-case';

@ApiTags('workspaces')
@Controller('workspaces')
export class WorkspacesController {
  constructor(
    private readonly createWorkspaceUseCase: CreateWorkspaceUseCase,
    private readonly verifyOnboardingOtpUseCase: VerifyOnboardingOtpUseCase,
    private readonly loginRequestUseCase: LoginRequestUseCase,
    private readonly loginVerifyUseCase: LoginVerifyUseCase,
    private readonly generateApiKeyUseCase: GenerateApiKeyUseCase,
    private readonly getApiKeysUseCase: GetApiKeysUseCase,
    private readonly deleteApiKeyUseCase: DeleteApiKeyUseCase,
    private readonly registerCredentialsUseCase: RegisterCredentialsUseCase,
    private readonly getWorkspaceAnalyticsUseCase: GetWorkspaceAnalyticsUseCase,
    private readonly getWorkspaceAuditLogsUseCase: GetWorkspaceAuditLogsUseCase,
    private readonly simulateWebhookUseCase: SimulateWebhookUseCase,
    private readonly getWorkspaceQuarantineUseCase: GetWorkspaceQuarantineUseCase,
    private readonly releaseQuarantinedFundsUseCase: ReleaseQuarantinedFundsUseCase,
    private readonly rejectQuarantinedFundsUseCase: RejectQuarantinedFundsUseCase,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Register a new developer workspace and user (Inactive initially)',
  })
  @ApiResponse({
    status: 201,
    description: 'Workspace created. Please check email for OTP verification.',
  })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async createWorkspace(@Body() dto: CreateWorkspaceDto) {
    return this.createWorkspaceUseCase.execute(dto);
  }

  @Post('verify-onboarding')
  @ApiOperation({
    summary: 'Verify email onboarding OTP and activate developer user',
  })
  @ApiResponse({ status: 200, description: 'Account activated successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyOnboarding(@Body() dto: VerifyOtpDto) {
    return this.verifyOnboardingOtpUseCase.execute(dto);
  }

  @Post('login')
  @ApiOperation({
    summary: 'Request login verification OTP (Sends code to registered email)',
  })
  @ApiResponse({ status: 200, description: 'OTP sent to email.' })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or inactive account',
  })
  async login(@Body() dto: LoginDto) {
    return this.loginRequestUseCase.execute(dto);
  }

  @Post('login/verify')
  @ApiOperation({ summary: 'Verify login OTP and issue JWT access_token' })
  @ApiResponse({
    status: 200,
    description: 'Authenticated successfully. Returns access token.',
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyLogin(@Body() dto: VerifyOtpDto) {
    return this.loginVerifyUseCase.execute(dto);
  }

  @Post(':workspaceId/api-keys')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate a new workspace API key (Requires JWT)' })
  @ApiResponse({ status: 201, description: 'API Key generated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async generateApiKey(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: GenerateApiKeyDto,
  ): Promise<{ rawKey: string; name: string; createdAt: Date }> {
    return this.generateApiKeyUseCase.execute(workspaceId, dto);
  }

  @Get(':workspaceId/api-keys')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all API keys in a workspace (Requires JWT)' })
  @ApiResponse({ status: 200, description: 'API keys retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async getApiKeys(
    @Param('workspaceId') workspaceId: string,
  ): Promise<{ id: string; name: string; createdAt: Date }[]> {
    return this.getApiKeysUseCase.execute(workspaceId);
  }

  @Delete(':workspaceId/api-keys/:keyId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke/Delete a specific API key (Requires JWT)' })
  @ApiResponse({ status: 204, description: 'API Key deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async deleteApiKey(
    @Param('workspaceId') workspaceId: string,
    @Param('keyId') keyId: string,
  ): Promise<void> {
    return this.deleteApiKeyUseCase.execute(workspaceId, keyId);
  }

  @Post(':workspaceId/credentials')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Register encrypted Nomba sandbox API credentials (Requires JWT)',
  })
  @ApiResponse({
    status: 201,
    description: 'Credentials registered successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async registerCredentials(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: RegisterCredentialsDto,
  ): Promise<NombaCredential> {
    return this.registerCredentialsUseCase.execute(workspaceId, dto);
  }

  @Get(':workspaceId/analytics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get workspace dashboard analytics (Requires JWT)' })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async getAnalytics(@Param('workspaceId') workspaceId: string) {
    return this.getWorkspaceAnalyticsUseCase.execute(workspaceId);
  }

  @Get(':workspaceId/audit-logs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get workspace chronological audit logs (Requires JWT)',
  })
  @ApiResponse({
    status: 200,
    description: 'Audit logs retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async getAuditLogs(
    @Param('workspaceId') workspaceId: string,
    @Query() query: AuditLogQueryDto,
  ): Promise<PaginatedResult<AuditLog>> {
    return this.getWorkspaceAuditLogsUseCase.execute(workspaceId, query);
  }

  @Post(':workspaceId/simulate-webhook')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Simulate an incoming Nomba payment success webhook deposit (Requires JWT)',
  })
  @ApiResponse({
    status: 200,
    description: 'Simulated payment processed successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async simulateWebhook(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: SimulateWebhookDto,
  ) {
    return this.simulateWebhookUseCase.execute(workspaceId, dto);
  }

  @Get(':workspaceId/quarantine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all quarantined ledger entries in the workspace (Requires JWT)',
  })
  @ApiResponse({
    status: 200,
    description: 'Quarantined transactions retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async getQuarantine(
    @Param('workspaceId') workspaceId: string,
    @Query() query: LedgerQueryDto,
  ): Promise<PaginatedResult<LedgerEntry>> {
    return this.getWorkspaceQuarantineUseCase.execute(workspaceId, query);
  }

  @Post(':workspaceId/quarantine/:ledgerEntryId/release')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Release quarantined funds and credit target wallet (Requires JWT)',
  })
  @ApiResponse({
    status: 200,
    description: 'Quarantined funds released successfully',
  })
  @ApiResponse({ status: 400, description: 'Target wallet must be active' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Quarantined entry not found' })
  async releaseQuarantine(
    @Param('workspaceId') workspaceId: string,
    @Param('ledgerEntryId') ledgerEntryId: string,
  ) {
    return this.releaseQuarantinedFundsUseCase.execute(
      workspaceId,
      ledgerEntryId,
    );
  }

  @Post(':workspaceId/quarantine/:ledgerEntryId/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reject quarantined funds and mark transaction as failed (Requires JWT)',
  })
  @ApiResponse({
    status: 200,
    description: 'Quarantined funds rejected successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Quarantined entry not found' })
  async rejectQuarantine(
    @Param('workspaceId') workspaceId: string,
    @Param('ledgerEntryId') ledgerEntryId: string,
  ) {
    return this.rejectQuarantinedFundsUseCase.execute(
      workspaceId,
      ledgerEntryId,
    );
  }
}
