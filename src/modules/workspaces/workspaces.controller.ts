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
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { AuditLog } from '@generated/prisma/client';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { RegisterCredentialsDto } from './dto/register-credentials.dto';
import { GenerateApiKeyDto } from './dto/generate-api-key.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { LoginDto } from './dto/login.dto';
import { SimulateWebhookDto } from './dto/simulate-webhook.dto';
import { NombaCredential } from '@generated/prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { PaginatedResult } from '@shared/utils/pagination.util';

@ApiTags('workspaces')
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

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
    return this.workspacesService.createWorkspace(dto);
  }

  @Post('verify-onboarding')
  @ApiOperation({
    summary: 'Verify email onboarding OTP and activate developer user',
  })
  @ApiResponse({ status: 200, description: 'Account activated successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyOnboarding(@Body() dto: VerifyOtpDto) {
    return this.workspacesService.verifyOnboardingOtp(dto);
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
    return this.workspacesService.loginRequest(dto);
  }

  @Post('login/verify')
  @ApiOperation({ summary: 'Verify login OTP and issue JWT access_token' })
  @ApiResponse({
    status: 200,
    description: 'Authenticated successfully. Returns access token.',
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyLogin(@Body() dto: VerifyOtpDto) {
    return this.workspacesService.loginVerify(dto);
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
    return this.workspacesService.generateApiKey(workspaceId, dto);
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
    return this.workspacesService.getApiKeys(workspaceId);
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
    return this.workspacesService.deleteApiKey(workspaceId, keyId);
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
    return this.workspacesService.registerCredentials(workspaceId, dto);
  }

  @Get(':workspaceId/analytics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get workspace dashboard analytics (Requires JWT)' })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async getAnalytics(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.getWorkspaceAnalytics(workspaceId);
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
    return this.workspacesService.getWorkspaceAuditLogs(workspaceId, query);
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
    return this.workspacesService.simulateWebhook(workspaceId, dto);
  }
}
