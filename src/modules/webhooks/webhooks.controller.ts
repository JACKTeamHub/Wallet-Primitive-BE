import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
  Query,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiBody,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '@shared/guards/api-key.guard';
import { WorkspaceId } from '@shared/decorators/workspace-id.decorator';
import { WebhookQueryDto } from './dto/webhook-query.dto';
import { PaginatedResult } from '@shared/utils/pagination.util';
import { ProcessedWebhook } from '@generated/prisma/client';

// Import Use Cases
import { HandleNombaWebhookUseCase } from './use-cases/handle-nomba-webhook.use-case';
import { ListWebhooksUseCase } from './use-cases/list-webhooks.use-case';
import { GetWebhookDetailUseCase } from './use-cases/get-webhook-detail.use-case';

@ApiTags('webhooks')
@Controller(['webhook', 'webhooks'])
export class WebhooksController {
  constructor(
    private readonly handleNombaWebhookUseCase: HandleNombaWebhookUseCase,
    private readonly listWebhooksUseCase: ListWebhooksUseCase,
    private readonly getWebhookDetailUseCase: GetWebhookDetailUseCase,
  ) {}

  @Post('nomba')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive incoming webhook events from Nomba' })
  @ApiHeader({
    name: 'nomba-signature',
    description: 'HMAC-SHA256 signature of the webhook payload',
    required: true,
  })
  @ApiHeader({
    name: 'nomba-timestamp',
    description: 'Timestamp when the webhook was generated',
    required: true,
  })
  @ApiBody({
    description: 'Incoming Nomba webhook payload',
    schema: {
      type: 'object',
      properties: {
        event_type: { type: 'string', example: 'payment_success' },
        requestId: { type: 'string', example: 'req_12345' },
        data: {
          type: 'object',
          properties: {
            merchant: {
              type: 'object',
              properties: {
                userId: { type: 'string', example: 'dev-user-id' },
                walletId: { type: 'string', example: 'dev-wallet-id' },
              },
            },
            transaction: {
              type: 'object',
              properties: {
                aliasAccountNumber: { type: 'string', example: '1950215058' },
                transactionAmount: { type: 'number', example: 4000 },
                transactionId: { type: 'string', example: 'tx_abc123' },
                type: { type: 'string', example: 'vact_transfer' },
                time: { type: 'string', example: '2026-07-01T12:00:00.000Z' },
                responseCode: { type: 'string', example: '' },
                narration: { type: 'string', example: 'Test deposit' },
                sessionId: { type: 'string', example: 'sess_123' },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleWebhook(
    @Body() payload: Record<string, any>,
    @Headers() headers: Record<string, string>,
  ) {
    return this.handleNombaWebhookUseCase.execute(payload, headers);
  }

  @Get()
  @UseGuards(ApiKeyGuard)
  @ApiHeader({
    name: 'x-api-key',
    description: 'Developer workspace API key',
    required: true,
  })
  @ApiOperation({ summary: 'List all processed webhook events' })
  @ApiResponse({ status: 200, description: 'Webhooks list retrieved successfully' })
  async list(
    @WorkspaceId() workspaceId: string,
    @Query() query: WebhookQueryDto,
  ): Promise<PaginatedResult<ProcessedWebhook>> {
    return this.listWebhooksUseCase.execute(workspaceId, query);
  }

  @Get(':id')
  @UseGuards(ApiKeyGuard)
  @ApiHeader({
    name: 'x-api-key',
    description: 'Developer workspace API key',
    required: true,
  })
  @ApiOperation({ summary: 'Get a specific processed webhook details' })
  @ApiResponse({ status: 200, description: 'Processed webhook details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async getDetail(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.getWebhookDetailUseCase.execute(workspaceId, id);
  }
}
