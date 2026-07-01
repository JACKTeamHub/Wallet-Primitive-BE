import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { RegisterCredentialsDto } from './dto/register-credentials.dto';
import { GenerateApiKeyDto } from './dto/generate-api-key.dto';
import { NombaCredential } from '@generated/prisma/client';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('workspaces')
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new developer workspace and user' })
  @ApiResponse({ status: 201, description: 'Workspace created successfully' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async createWorkspace(@Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.createWorkspace(dto);
  }

  @Post(':workspaceId/api-keys')
  @ApiOperation({ summary: 'Generate a new workspace API key' })
  @ApiResponse({ status: 201, description: 'API Key generated successfully' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async generateApiKey(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: GenerateApiKeyDto,
  ): Promise<{ rawKey: string; name: string; createdAt: Date }> {
    return this.workspacesService.generateApiKey(workspaceId, dto);
  }

  @Get(':workspaceId/api-keys')
  @ApiOperation({ summary: 'List all API keys in a workspace' })
  @ApiResponse({ status: 200, description: 'API keys retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async getApiKeys(
    @Param('workspaceId') workspaceId: string,
  ): Promise<{ id: string; name: string; createdAt: Date }[]> {
    return this.workspacesService.getApiKeys(workspaceId);
  }

  @Post(':workspaceId/credentials')
  @ApiOperation({ summary: 'Register encrypted Nomba sandbox API credentials' })
  @ApiResponse({
    status: 201,
    description: 'Credentials registered successfully',
  })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async registerCredentials(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: RegisterCredentialsDto,
  ): Promise<NombaCredential> {
    return this.workspacesService.registerCredentials(workspaceId, dto);
  }
}
